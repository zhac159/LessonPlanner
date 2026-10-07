/**
 * The review queue (agents/ASSETS.md §3.2, §5.1, §5.2): pictures found in her files (or picked online) wait in
 * review batches on disk until she says "Keep". The service owns the batches and runs one job at a time (cut out
 * pictures, then name them with Claude); `ingest.ts` puts pictures into batches, `describe.ts` is the naming step,
 * `accept.ts` saves the ticked ones.
 */
import type {
  AddedPictures,
  AssetPage,
  AssetSummary,
  ReviewCandidate,
  ReviewEdit,
  ReviewFile,
  ReviewOrigin,
  ReviewView
} from '@shared/contracts/assets'
import { newId } from '@shared/ids'
import { fail, ok, type Failure, type Result } from '@shared/result'
import type { OnlineReviewPort } from '../online/types'
import type { NewAsset } from '../storeParts'
import { saveTicked } from './accept'
import { ReviewDisk } from './disk'
import { applyEdit } from './edit'
import { Ingest, type FoundContext } from './ingest'
import { readIntake, type IntakeFile } from './intake'
import type { CreateReviewBatchInput, ReviewBatchFile, ReviewBatchPort } from './ports'
import { INTERRUPTED_MESSAGE, recount, rowKind } from './rows'
import {
  KEEP_BATCH_MS,
  REVIEW_SCHEMA_VERSION,
  type ReviewServiceDeps,
  type StoredBatch,
  type StoredCandidate
} from './types'
import { readUploads, type UploadEnv } from './uploads'
import { bannerOf, candidateView, reviewView } from './view'

const EMIT_GAP_MS = 120

export class ReviewService implements ReviewBatchPort, OnlineReviewPort {
  private readonly batches = new Map<string, StoredBatch>()
  private readonly thumbs = new Map<string, string>()
  private readonly jobs = new Map<string, { abort: AbortController; count: number }>()
  private readonly disk: ReviewDisk
  private readonly ingest: Ingest
  /** Files that could not be read, by row id: "Try again" reads them again. In memory only (a restart says "Add it again"). */
  private readonly failedFiles = new Map<string, IntakeFile>()
  private queue: Promise<void> = Promise.resolve()
  private lastEmit = 0

  constructor(private readonly deps: ReviewServiceDeps) {
    this.disk = new ReviewDisk(deps.dir)
    this.ingest = new Ingest({
      deps,
      disk: this.disk,
      thumbs: this.thumbs,
      alive: (batch) => this.batches.get(batch.id) === batch,
      taken: (except) => this.takenNames(except),
      commit: (batch) => this.commit(batch)
    })
  }

  private get nowIso(): string {
    return (this.deps.now ?? (() => new Date()))().toISOString()
  }
  private id = (prefix: string): string => (this.deps.newId ?? newId)(prefix)
  private takenNames(except?: string): string[] {
    const names = [...this.deps.assets.takenNames()]
    for (const batch of this.batches.values()) {
      for (const c of batch.candidates) if (c.id !== except) names.push(c.name)
    }
    return names
  }

  // ---- loading and reading ------------------------------------------------------------------------

  /** Reads the batches from disk (a restart loses nothing); batches unreviewed for 30 days are removed. */
  async init(): Promise<void> {
    const loaded = await this.disk.loadAll(this.deps.log?.warn)
    const oldest = Date.parse(this.nowIso) - KEEP_BATCH_MS
    for (const batch of loaded.sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
      if (Date.parse(batch.startedAt) < oldest) {
        await this.disk.remove(batch.id)
        continue
      }
      for (const file of batch.files) {
        if (file.state === 'waiting' || file.state === 'working') {
          Object.assign(file, { state: 'failed', error: INTERRUPTED_MESSAGE, progress: null })
        }
      }
      batch.working = false
      this.batches.set(batch.id, batch)
      for (const c of batch.candidates) {
        const png = await this.disk.readThumb(batch.id, c.id)
        if (png)
          this.thumbs.set(c.id, `data:image/png;base64,${Buffer.from(png).toString('base64')}`)
      }
    }
  }

  view(): ReviewView {
    return reviewView([...this.batches.values()], this.thumbs)
  }
  /** The A1 banner: "12 assets found while learning your Science KS3 style". */
  banner(): AssetPage['pendingReview'] {
    return bannerOf([...this.batches.values()])
  }
  /** Resolves when every job has finished and everything is on disk. */
  async idle(): Promise<void> {
    await this.queue
    await this.disk.flush()
  }
  dispose(): void {
    for (const job of this.jobs.values()) job.abort.abort()
  }

  private announce(throttled = false): void {
    const at = Date.now()
    if (throttled && at - this.lastEmit < EMIT_GAP_MS) return
    this.lastEmit = at
    this.deps.emit(this.view())
  }
  private async commit(batch: StoredBatch): Promise<void> {
    if (!this.batches.has(batch.id)) return
    await this.disk.save(batch)
    this.announce()
  }

  // ---- starting batches ---------------------------------------------------------------------------

  private open(origin: ReviewOrigin, files: ReviewFile[], working: boolean): StoredBatch {
    const batch: StoredBatch = {
      schemaVersion: REVIEW_SCHEMA_VERSION,
      id: this.id('rvb'),
      origin,
      startedAt: this.nowIso,
      files,
      working,
      candidates: []
    }
    this.batches.set(batch.id, batch)
    return batch
  }

  private uploadEnv(): UploadEnv {
    return {
      ingest: this.ingest,
      extract: this.deps.extract,
      alive: (batch) => this.batches.get(batch.id) === batch,
      commit: (batch) => this.commit(batch),
      announce: (throttled) => this.announce(throttled),
      at: this.nowIso,
      keepFailed: (fileId, file) => void this.failedFiles.set(fileId, file),
      warn: this.deps.log?.warn
    }
  }

  /** Queues a job for a batch; when it ends (or fails) the batch stops "working" and is saved. */
  private run(batch: StoredBatch, task: (signal: AbortSignal) => Promise<void>): void {
    const job = this.jobs.get(batch.id) ?? { abort: new AbortController(), count: 0 }
    job.count += 1
    this.jobs.set(batch.id, job)
    this.queue = this.queue.then(async () => {
      try {
        if (this.batches.get(batch.id) === batch) await task(job.abort.signal)
      } catch (error) {
        this.deps.log?.warn(`Review job failed: ${String(error)}`)
      } finally {
        job.count -= 1
        if (job.count === 0) {
          this.jobs.delete(batch.id)
          batch.working = false
        }
        await this.commit(batch)
      }
    })
  }

  /** `add:paths`: pictures, PDFs and PowerPoints become a new "Uploaded just now" batch, cut out in the background. */
  async addPaths(paths: readonly string[]): Promise<Result<AddedPictures>> {
    const { files, rejected } = await readIntake(paths)
    if (files.length === 0) return ok({ batchId: '', accepted: 0, rejected })
    const rows: ReviewFile[] = files.map((f) => ({
      id: this.id('rvf'),
      name: f.name,
      kind: f.kind,
      found: 0,
      state: 'waiting',
      progress: null
    }))
    const batch = this.open({ kind: 'upload' }, rows, true)
    await this.commit(batch)
    this.run(batch, (signal) => readUploads(this.uploadEnv(), batch, files, signal))
    return ok({ batchId: batch.id, accepted: files.length, rejected })
  }

  /** For style learning (WP6): pictures `groupFindings` found in a style's decks go to review; naming runs after. */
  async createReviewBatch(input: CreateReviewBatchInput): Promise<{ batchId: string }> {
    const names = [...new Set(input.candidates.flatMap((c) => c.foundIn.map((f) => f.fileName)))]
    const files: ReviewBatchFile[] = input.files ?? names.map((name) => ({ name }))
    const batch =
      (input.batchId && this.batches.get(input.batchId)) || this.open(input.source, [], true)
    batch.working = true
    for (const file of files) {
      if (batch.files.some((f) => f.name === file.name)) continue
      batch.files.push({
        id: this.id('rvf'),
        name: file.name,
        kind: rowKind(file.name),
        found: 0,
        state: 'working',
        progress: null
      })
    }
    await this.commit(batch)
    const context: FoundContext = {
      styleId: input.source.kind === 'style' ? input.source.styleId : null,
      files: batch.files.map((row) => ({
        name: row.name,
        sourceId: files.find((f) => f.name === row.name)?.sourceId ?? row.id
      })),
      fileId: (name) => batch.files.find((f) => f.name === name)?.id ?? '',
      at: this.nowIso
    }
    this.run(batch, async (signal) => {
      await this.ingest.mergeFound(batch, input.candidates, context)
      recount(batch)
      await this.commit(batch)
      await this.ingest.nameBatch(batch, signal)
      for (const file of batch.files) if (file.state === 'working') file.state = 'done'
    })
    return { batchId: batch.id }
  }

  /** For `online:add` with several pictures (origin "picked online"): names, licences and credits are already set. */
  async addOnlineBatch(candidates: NewAsset[]): Promise<{ batchId: string }> {
    const row: ReviewFile = {
      id: this.id('rvf'),
      name: 'Picked online',
      kind: 'image',
      found: 0,
      state: 'done',
      progress: null
    }
    const batch = this.open({ kind: 'online' }, [row], false)
    try {
      await this.ingest.addOnline(batch, candidates, row.id)
    } catch (error) {
      this.batches.delete(batch.id)
      await this.disk.remove(batch.id)
      throw error
    }
    recount(batch)
    await this.commit(batch)
    return { batchId: batch.id }
  }

  /** "Name these with Claude": tries again for pictures that were left with the extractor's names. */
  nameWithClaude(batchId: string): Result {
    const batch = this.batches.get(batchId)
    if (!batch) return fail('not-found', 'Those pictures are no longer waiting.')
    batch.working = true
    this.run(batch, async (signal) => void (await this.ingest.nameBatch(batch, signal)))
    return ok()
  }

  /** "Try again" on a file row that could not be read: reads that file again, in the background. */
  retryFile(batchId: string, fileId: string): Result {
    const batch = this.batches.get(batchId)
    const row = batch?.files.find((f) => f.id === fileId)
    if (!batch || !row) return fail('not-found', 'Those pictures are no longer waiting.')
    if (row.state !== 'failed') return fail('invalid-input', 'That file is already being read.')
    const file = this.failedFiles.get(fileId)
    if (!file) return fail('not-found', 'I no longer have that file. Add it again.')
    this.failedFiles.delete(fileId)
    row.state = 'waiting'
    row.error = undefined
    row.progress = null
    batch.working = true
    this.announce()
    this.run(batch, (signal) => readUploads(this.uploadEnv(), batch, [file], signal, [row]))
    return ok()
  }

  // ---- editing and deciding -----------------------------------------------------------------------

  private find(id: string): { batch: StoredBatch; candidate: StoredCandidate } | undefined {
    for (const batch of this.batches.values()) {
      const candidate = batch.candidates.find((c) => c.id === id)
      if (candidate) return { batch, candidate }
    }
    return undefined
  }

  async edit(edit: ReviewEdit): Promise<Result<{ candidate: ReviewCandidate }>> {
    const hit = this.find(edit.candidateId)
    if (!hit) return fail('not-found', 'That picture is no longer waiting.')
    const { batch, candidate } = hit
    const draft = structuredClone(candidate)
    const refusal = applyEdit(draft, edit, this.takenNames(candidate.id))
    if (refusal) return refusal
    Object.assign(candidate, draft)
    await this.commit(batch)
    const byId = new Map(batch.candidates.map((c) => [c.id, c]))
    const thumb = this.thumbs.get(candidate.id) ?? null
    return ok({ candidate: candidateView(candidate, batch.id, byId, thumb) })
  }

  /** Saves the ticked pictures into the library. A batch that is still being read stays open for the rest. */
  async accept(batchId?: string): Promise<Result<{ added: AssetSummary[] }>> {
    const picked = batchId ? this.batches.get(batchId) : undefined
    if (batchId && !picked) return fail('not-found', 'Those pictures are no longer waiting.')
    const added: AssetSummary[] = []
    let problem: Failure | null = null
    for (const batch of picked ? [picked] : [...this.batches.values()]) {
      const saved = await saveTicked(this.deps.assets, this.disk, batch, this.deps.log?.warn)
      added.push(...saved.added)
      if (saved.problem) problem ??= saved.problem
      if (!batch.working && !saved.problem) {
        this.batches.delete(batch.id)
        for (const f of batch.files) this.failedFiles.delete(f.id)
        await this.disk.remove(batch.id)
      } else {
        recount(batch)
        await this.disk.save(batch)
      }
    }
    this.announce()
    return added.length === 0 && problem ? problem : ok({ added })
  }

  /** Throws a batch away (and stops reading it). */
  async dismiss(batchId: string): Promise<Result> {
    const batch = this.batches.get(batchId)
    if (!batch) return ok()
    this.jobs.get(batchId)?.abort.abort()
    this.batches.delete(batchId)
    for (const f of batch.files) this.failedFiles.delete(f.id)
    for (const c of batch.candidates) this.thumbs.delete(c.id)
    await this.disk.remove(batchId)
    this.announce()
    return ok()
  }
}
