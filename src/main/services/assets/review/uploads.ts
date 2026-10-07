/**
 * The job behind "Upload" (A1/A2): each picked file is read in turn, its pictures go into the batch (candidates
 * appear as each file finishes) and Claude names them. One bad file marks its own row "failed"; the rest carry on.
 */
import { extractAssets, groupFindings, type ExtractedImage } from '../../../import/assets'
import type { Ingest, FoundContext } from './ingest'
import type { IntakeFile } from './intake'
import { SCANNED_MESSAGE, UNREADABLE_PICTURE, failureText, recount } from './rows'
import type { StoredBatch } from './types'
import type { ReviewFile } from '@shared/contracts/assets'

export interface UploadEnv {
  ingest: Ingest
  extract?: typeof extractAssets
  alive(batch: StoredBatch): boolean
  commit(batch: StoredBatch): Promise<void>
  /** Pushes `review:changed`; `throttled` skips it when one went out a moment ago (progress ticks). */
  announce(throttled?: boolean): void
  at: string
  /** A file that could not be read: the service keeps its bytes (in memory) so "Try again" needs no new pick. */
  keepFailed?(fileId: string, file: IntakeFile): void
  warn?(message: string): void
}

export async function readUploads(
  env: UploadEnv,
  batch: StoredBatch,
  files: readonly IntakeFile[],
  signal: AbortSignal,
  /** The rows of `files`, in order (all of the batch's rows for a first read; the one row of a retry). */
  rows: readonly ReviewFile[] = batch.files
): Promise<void> {
  const extract = env.extract ?? extractAssets
  const seen: ExtractedImage[] = []
  const context: FoundContext = {
    styleId: null,
    files: batch.files.map((f) => ({ name: f.name, sourceId: f.id })),
    fileId: (name) => batch.files.find((f) => f.name === name)?.id ?? '',
    at: env.at
  }
  for (const [i, upload] of files.entries()) {
    const row = rows[i]!
    if (signal.aborted || !env.alive(batch)) return
    row.state = 'working'
    env.announce()
    try {
      if (upload.kind === 'image') {
        if (!(await env.ingest.addPicture(batch, upload, row.id, env.at))) {
          throw new Error(UNREADABLE_PICTURE)
        }
      } else {
        const result = await extract(upload, {
          signal,
          onProgress: (progress) => {
            row.progress = progress
            env.announce(true)
          }
        })
        if (result.scanned && result.images.length === 0) throw new Error(SCANNED_MESSAGE)
        seen.push(...result.images)
        await env.ingest.mergeFound(batch, groupFindings(seen).assets, context)
      }
      row.progress = null
      recount(batch)
      await env.commit(batch)
      await env.ingest.nameBatch(batch, signal)
      row.state = 'done'
    } catch (error) {
      row.state = 'failed'
      row.progress = null
      row.error = failureText(error)
      env.keepFailed?.(row.id, upload)
      env.warn?.(`Could not read ${row.name}: ${String(error)}`)
    }
    await env.commit(batch)
  }
}
