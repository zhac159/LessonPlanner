/**
 * "Keep N assets": the ticked candidates of a batch become library assets (file, thumbnail, description, credit,
 * `foundIn`), and leave the batch. Names that were taken in the meantime are replaced by the next free one.
 */
import type { AssetSummary } from '@shared/contracts/assets'
import type { Failure } from '@shared/result'
import { failureOf } from '../service'
import type { ReviewDisk } from './disk'
import type { ReviewAssetsPort, StoredBatch, StoredCandidate } from './types'

export interface SaveResult {
  added: AssetSummary[]
  /** The first picture that could not be saved (it stays ticked in its batch); null when all went well. */
  problem: Failure | null
}

export async function saveTicked(
  assets: ReviewAssetsPort,
  disk: ReviewDisk,
  batch: StoredBatch,
  warn?: (message: string) => void
): Promise<SaveResult> {
  const added: AssetSummary[] = []
  let problem: Failure | null = null
  const drop = async (c: StoredCandidate): Promise<void> => {
    batch.candidates = batch.candidates.filter((x) => x !== c)
    batch.handled = [...(batch.handled ?? []), ...c.occurrences]
    await disk.removePicture(batch.id, c)
  }
  for (const c of batch.candidates.filter((x) => x.keep)) {
    const bytes = await disk.readPicture(batch.id, c)
    // gone from disk, or the same picture was saved from another batch in the meantime: nothing to add
    if (!bytes || assets.findBySha(c.sha256)) {
      await drop(c)
      continue
    }
    try {
      const asset = await assets.add({
        bytes,
        ext: c.ext,
        name: c.name,
        title: c.title,
        kind: c.kind,
        description: c.description,
        tags: c.tags,
        source: c.source,
        licence: c.licence,
        credit: c.credit,
        foundIn: c.foundIn,
        autoName: true
      })
      added.push(await assets.summary(asset))
      await drop(c)
    } catch (error) {
      problem ??= failureOf(error, warn)
    }
  }
  return { added, problem }
}
