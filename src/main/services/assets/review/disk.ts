/**
 * The review queue's files: `review/<batchId>/batch.json`, the cut-out pictures `<candidateId><ext>` and their
 * small thumbnails `<candidateId>.thumb.png`, so a restart loses nothing (agents/ASSETS.md §2.7).
 * Writes of one batch go through one queue, so a slow write can never overwrite a newer one.
 */
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFileAtomic } from '../../../export/save'
import { atomicWriteJson, readJsonSafe } from '../../fsx'
import { subfolders } from '../storeParts'
import { REVIEW_SCHEMA_VERSION, type StoredBatch, type StoredCandidate } from './types'

const SAFE = /^[A-Za-z0-9_-]{1,80}$/

/** Shallow check of a `batch.json`: anything wrong and the batch is set aside rather than half used. */
function parseBatch(raw: unknown, folder: string): StoredBatch {
  const batch = raw as Partial<StoredBatch> | null
  if (
    !batch ||
    batch.schemaVersion !== REVIEW_SCHEMA_VERSION ||
    batch.id !== folder ||
    typeof batch.startedAt !== 'string' ||
    !Array.isArray(batch.files) ||
    !Array.isArray(batch.candidates) ||
    !batch.origin
  ) {
    throw new Error('not a review batch')
  }
  return batch as StoredBatch
}

export class ReviewDisk {
  private readonly chains = new Map<string, Promise<void>>()

  constructor(private readonly dir: string) {}

  private get root(): string {
    return join(this.dir, 'review')
  }
  private folder(batchId: string): string {
    if (!SAFE.test(batchId)) throw new Error(`unsafe batch id ${batchId}`)
    return join(this.root, batchId)
  }
  private queue(batchId: string, task: () => Promise<void>): Promise<void> {
    const next = (this.chains.get(batchId) ?? Promise.resolve()).then(task, task)
    const settled = next.catch(() => undefined)
    this.chains.set(batchId, settled)
    return next
  }

  fileName = (candidate: Pick<StoredCandidate, 'id' | 'ext'>): string =>
    `${candidate.id}${candidate.ext}`

  /** Every readable batch; candidates whose picture file is gone are dropped, damaged folders are skipped. */
  async loadAll(warn?: (message: string) => void): Promise<StoredBatch[]> {
    const out: StoredBatch[] = []
    for (const id of await subfolders(this.root)) {
      const batch = await readJsonSafe(join(this.root, id, 'batch.json'), (raw) =>
        parseBatch(raw, id)
      )
      if (!batch) {
        warn?.(`Review batch ${id} could not be read and was left alone.`)
        continue
      }
      const present: StoredCandidate[] = []
      for (const candidate of batch.candidates) {
        const ok = await readFile(join(this.root, id, this.fileName(candidate))).then(
          () => true,
          () => false
        )
        if (ok) present.push(candidate)
      }
      out.push({ ...batch, candidates: present })
    }
    return out
  }

  /** Queues a write of `batch.json` (a snapshot taken now). Resolves when it is on disk. */
  save(batch: StoredBatch): Promise<void> {
    const snapshot = structuredClone(batch)
    return this.queue(batch.id, () =>
      atomicWriteJson(join(this.folder(batch.id), 'batch.json'), snapshot)
    )
  }

  writePicture(batchId: string, candidate: StoredCandidate, bytes: Uint8Array): Promise<void> {
    return writeFileAtomic(join(this.folder(batchId), this.fileName(candidate)), bytes)
  }
  writeThumb(batchId: string, candidateId: string, png: Uint8Array): Promise<void> {
    return writeFileAtomic(join(this.folder(batchId), `${candidateId}.thumb.png`), png)
  }
  async readPicture(batchId: string, candidate: StoredCandidate): Promise<Uint8Array | undefined> {
    try {
      return new Uint8Array(await readFile(join(this.folder(batchId), this.fileName(candidate))))
    } catch {
      return undefined
    }
  }
  async readThumb(batchId: string, candidateId: string): Promise<Uint8Array | undefined> {
    try {
      return new Uint8Array(await readFile(join(this.folder(batchId), `${candidateId}.thumb.png`)))
    } catch {
      return undefined
    }
  }

  /** Removes a candidate's picture and thumbnail. Never throws. */
  async removePicture(batchId: string, candidate: StoredCandidate): Promise<void> {
    const folder = this.folder(batchId)
    await Promise.all([
      rm(join(folder, this.fileName(candidate)), { force: true }),
      rm(join(folder, `${candidate.id}.thumb.png`), { force: true })
    ]).catch(() => undefined)
  }

  /** Removes the whole batch folder (after its queued writes). */
  async remove(batchId: string): Promise<void> {
    const folder = this.folder(batchId)
    await this.queue(batchId, () => rm(folder, { recursive: true, force: true })).catch(
      () => undefined
    )
    this.chains.delete(batchId)
  }

  /** Resolves when every queued write has finished. */
  async flush(): Promise<void> {
    await Promise.all([...this.chains.values()])
  }
}
