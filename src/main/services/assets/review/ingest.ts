/**
 * Putting pictures into a batch: what the extraction service found, a single uploaded picture, pictures picked
 * online. Each becomes a `StoredCandidate` (file and thumbnail on disk, library duplicates marked, a first name),
 * then Claude names and describes them in chunks of 12 (./describe). State lives in the service; this class works
 * on the batch objects it is handed and asks the host to save and announce.
 */
import { newId } from '@shared/ids'
import { uniqueAssetName, slugifyAssetName } from '@shared/assets/names'
import type { AssetSource } from '@shared/assets/types'
import { sniffMime, type FoundAsset } from '../../../import/assets'
import { cleanDescription, cleanTitle, normaliseTags } from '../library'
import { prepareFile, type NewAsset } from '../storeParts'
import { toDataUrl } from '../thumbs'
import { THUMB_SIDE } from '../imageTools'
import {
  foundInOf,
  kindFromHint,
  pictureFileOf,
  refreshSuggestions,
  type PictureFile
} from './candidates'
import { applyDescribed, describeChunk, needsNaming, type NamingItem } from './describe'
import type { ReviewDisk } from './disk'
import type { ReviewBatchFile } from './ports'
import {
  DESCRIBE_CHUNK,
  MAX_CANDIDATES,
  type ReviewServiceDeps,
  type StoredBatch,
  type StoredCandidate
} from './types'

/** What the ingest needs from the service that owns the batches. */
export interface IngestHost {
  deps: ReviewServiceDeps
  disk: ReviewDisk
  thumbs: Map<string, string>
  /** False once the batch was dismissed: the job stops touching it. */
  alive(batch: StoredBatch): boolean
  /** Names in use in the library and in every open batch (the one being asked about excepted). */
  taken(except?: string): string[]
  /** Saves `batch.json` and tells the window. */
  commit(batch: StoredBatch): Promise<void>
}

export interface FoundContext {
  styleId: string | null
  files: ReviewBatchFile[]
  /** The `ReviewFile` id of a deck name. */
  fileId(fileName: string): string
  at: string
}

export class Ingest {
  constructor(private readonly host: IngestHost) {}

  private get id(): string {
    return (this.host.deps.newId ?? newId)('rc')
  }

  /** Writes the picture and its thumbnail; the candidate is only added by the caller. */
  private async store(batch: StoredBatch, c: StoredCandidate, file: PictureFile): Promise<void> {
    await this.host.disk.writePicture(batch.id, c, file.bytes)
    const small = await this.host.deps.tools.scale(file.bytes, c.ext, THUMB_SIDE)
    if (small) {
      await this.host.disk.writeThumb(batch.id, c.id, small.png)
      this.host.thumbs.set(c.id, toDataUrl(small.png))
    }
    if (!this.host.alive(batch)) {
      // dismissed while the picture was being written: leave no folder behind
      this.host.thumbs.delete(c.id)
      await this.host.disk.remove(batch.id)
    }
  }

  private blank(file: PictureFile, over: Partial<StoredCandidate>): StoredCandidate {
    const library = this.host.deps.assets.findBySha(file.sha256)
    return {
      id: this.id,
      fileId: '',
      foundId: '',
      occurrences: [],
      name: 'picture',
      title: 'Picture',
      kind: 'picture',
      description: '',
      tags: [],
      ext: file.ext,
      width: file.width,
      height: file.height,
      bytes: file.bytes.byteLength,
      sha256: file.sha256,
      keep: false,
      suggestedKeep: false,
      extractorReason: null,
      duplicateOf: library?.name ?? null,
      olderOf: null,
      claudePupils: false,
      hint: 'other',
      nearbyText: '',
      fileNames: [],
      named: false,
      edited: [],
      foundIn: [],
      source: { kind: 'uploaded', fileName: '', at: '' },
      licence: { id: 'unknown', label: 'From your files', requiresCredit: false },
      credit: null,
      autoName: true,
      ...over
    }
  }

  // ---- pictures the extraction service found ---------------------------------------------------

  async mergeFound(
    batch: StoredBatch,
    found: readonly FoundAsset[],
    context: FoundContext
  ): Promise<void> {
    const byFoundId = new Map<string, StoredCandidate>()
    const handled = new Set(batch.handled)
    for (const asset of found) {
      if (!this.host.alive(batch)) return
      if (asset.occurrenceIds.some((o) => handled.has(o))) continue
      const foundIn = foundInOf(asset, context.styleId, context.files)
      const known = batch.candidates.find((c) =>
        c.occurrences.some((o) => asset.occurrenceIds.includes(o))
      )
      if (known) {
        this.update(known, asset, foundIn)
        byFoundId.set(asset.id, known)
        continue
      }
      if (batch.candidates.length >= MAX_CANDIDATES) continue
      const file = await pictureFileOf(asset.image, this.host.deps.tools)
      if (!file) continue
      const twin = batch.candidates.find((c) => c.sha256 === file.sha256)
      if (twin) {
        this.update(twin, asset, foundIn)
        byFoundId.set(asset.id, twin)
        continue
      }
      const first = foundIn[0]
      const source: AssetSource = {
        kind: 'extracted',
        styleId: context.styleId,
        fileName: first?.fileName ?? asset.image.fileName,
        page: first?.page ?? null,
        at: context.at
      }
      const candidate = this.blank(file, {
        fileId: context.fileId(asset.image.fileName),
        foundId: asset.id,
        occurrences: [...asset.occurrenceIds],
        name: uniqueAssetName(asset.suggestedName, this.host.taken()),
        title: cleanTitle('', asset.suggestedName),
        kind: kindFromHint(asset.kind),
        hint: asset.kind,
        nearbyText: asset.nearbyText,
        fileNames: asset.foundIn.map((f) => f.fileName),
        extractorReason: asset.leftOut ?? null,
        foundIn,
        source
      })
      if (!this.host.alive(batch)) return
      await this.store(batch, candidate, file)
      batch.candidates.push(candidate)
      byFoundId.set(asset.id, candidate)
    }
    for (const asset of found) {
      const candidate = byFoundId.get(asset.id)
      const primary = asset.olderVersionOf ? byFoundId.get(asset.olderVersionOf) : undefined
      if (candidate && primary && candidate !== primary) candidate.olderOf = primary.id
    }
    refreshSuggestions(batch.candidates)
  }

  /** The same picture seen again (another deck, a later grouping): decks and the extractor's verdict move on. */
  private update(c: StoredCandidate, asset: FoundAsset, foundIn: StoredCandidate['foundIn']): void {
    for (const o of asset.occurrenceIds) if (!c.occurrences.includes(o)) c.occurrences.push(o)
    for (const entry of foundIn) {
      if (!c.foundIn.some((f) => f.sourceId === entry.sourceId && f.page === entry.page)) {
        c.foundIn.push(entry)
      }
    }
    c.fileNames = [...new Set([...c.fileNames, ...asset.foundIn.map((f) => f.fileName)])]
    c.extractorReason = asset.leftOut ?? null
  }

  // ---- a single picture she uploaded -------------------------------------------------------------

  async addPicture(
    batch: StoredBatch,
    upload: { name: string; bytes: Uint8Array },
    fileId: string,
    at: string
  ): Promise<boolean> {
    const mime = sniffMime(upload.bytes)
    const file = mime && (await pictureFileOf({ bytes: upload.bytes, mime }, this.host.deps.tools))
    if (!file || !this.host.alive(batch)) return false
    const twin = batch.candidates.find((c) => c.sha256 === file.sha256)
    if (twin) return true
    const stem = upload.name.replace(/\.[^.]+$/, '')
    const candidate = this.blank(file, {
      fileId,
      name: uniqueAssetName(stem, this.host.taken()),
      title: cleanTitle(stem.replace(/[_-]+/g, ' '), 'picture'),
      fileNames: [upload.name],
      source: { kind: 'uploaded', fileName: upload.name, at }
    })
    await this.store(batch, candidate, file)
    batch.candidates.push(candidate)
    refreshSuggestions(batch.candidates)
    return true
  }

  // ---- pictures picked online (names, licences and credits already filled in) --------------------

  async addOnline(batch: StoredBatch, inputs: readonly NewAsset[], fileId: string): Promise<void> {
    for (const input of inputs) {
      if (batch.candidates.length >= MAX_CANDIDATES) break
      const prepared = await prepareFile(input.bytes, input.ext, this.host.deps.tools)
      const file: PictureFile = {
        bytes: prepared.bytes,
        ext: prepared.file.ext,
        width: prepared.file.width,
        height: prepared.file.height,
        sha256: prepared.file.sha256
      }
      if (batch.candidates.some((c) => c.sha256 === file.sha256)) continue
      const candidate = this.blank(file, {
        fileId,
        name: uniqueAssetName(slugifyAssetName(input.name) || input.title, this.host.taken()),
        title: cleanTitle(input.title, input.name),
        kind: input.kind,
        description: cleanDescription(input.description ?? ''),
        tags: normaliseTags(input.tags ?? []),
        source: input.source,
        licence: input.licence,
        credit: input.credit ?? null,
        foundIn: input.foundIn ?? [],
        autoName: input.autoName ?? false,
        named: true
      })
      await this.store(batch, candidate, file)
      batch.candidates.push(candidate)
    }
    refreshSuggestions(batch.candidates)
  }

  // ---- naming (Claude, cheap, 12 per call, cached) -----------------------------------------------

  /** Names and describes what is still unnamed. Resolves to true when a call failed (names stay the extractor's). */
  async nameBatch(batch: StoredBatch, signal?: AbortSignal): Promise<boolean> {
    let failed = false
    const todo = batch.candidates.filter(needsNaming)
    for (let from = 0; from < todo.length; from += DESCRIBE_CHUNK) {
      if (!this.host.alive(batch) || signal?.aborted) return failed
      const items: NamingItem[] = []
      for (const candidate of todo.slice(from, from + DESCRIBE_CHUNK)) {
        const bytes = await this.host.disk.readPicture(batch.id, candidate)
        if (bytes) items.push({ candidate, bytes })
      }
      const { described, failed: chunkFailed } = await describeChunk(
        this.host.deps,
        items,
        this.host.taken(),
        signal
      )
      if (!this.host.alive(batch)) return failed
      failed ||= chunkFailed
      for (const { candidate } of items) {
        const result = described.get(candidate.id)
        if (result) applyDescribed(candidate, result, this.host.taken(candidate.id))
      }
      refreshSuggestions(batch.candidates)
      await this.host.commit(batch)
    }
    return failed
  }
}
