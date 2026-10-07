/** Stored batches as the contract's `ReviewView` (agents/ASSETS.md §3.2): counts, candidates, "still reading". */
import type { AssetPage, ReviewBatch, ReviewCandidate, ReviewView } from '@shared/contracts/assets'
import { leftOutOf } from './candidates'
import type { StoredBatch, StoredCandidate } from './types'

export function candidateView(
  candidate: StoredCandidate,
  batchId: string,
  byId: ReadonlyMap<string, StoredCandidate>,
  thumbDataUrl: string | null
): ReviewCandidate {
  const decks = new Set(candidate.foundIn.map((f) => `${f.styleId}:${f.sourceId}`)).size
  return {
    id: candidate.id,
    batchId,
    name: candidate.name,
    title: candidate.title,
    kind: candidate.kind,
    description: candidate.description,
    tags: candidate.tags,
    thumbDataUrl,
    width: candidate.width,
    height: candidate.height,
    decks,
    foundIn: candidate.foundIn,
    keep: candidate.keep,
    suggestedKeep: candidate.suggestedKeep,
    leftOut: leftOutOf(candidate, byId)
  }
}

export const batchView = (batch: StoredBatch): ReviewBatch => ({
  id: batch.id,
  origin: batch.origin,
  startedAt: batch.startedAt,
  files: batch.files,
  working: batch.working
})

/** Candidates are shown ticked first, then in the order they were found. */
export function reviewView(
  batches: readonly StoredBatch[],
  thumbs: ReadonlyMap<string, string>
): ReviewView {
  const candidates: ReviewCandidate[] = []
  for (const batch of batches) {
    const byId = new Map(batch.candidates.map((c) => [c.id, c]))
    for (const c of batch.candidates) {
      candidates.push(candidateView(c, batch.id, byId, thumbs.get(c.id) ?? null))
    }
  }
  const keeping = candidates.filter((c) => c.keep).length
  return {
    batches: batches.map(batchView),
    candidates,
    found: candidates.length,
    keeping,
    leftOut: candidates.length - keeping,
    stillReading: batches.reduce(
      (sum, b) =>
        sum + b.files.filter((f) => f.state === 'waiting' || f.state === 'working').length,
      0
    )
  }
}

/** The A1 banner: the newest batch that has something to look at (style batches first). */
export function bannerOf(batches: readonly StoredBatch[]): AssetPage['pendingReview'] {
  const open = batches.filter((b) => b.candidates.length > 0)
  const pick = [...open].reverse().find((b) => b.origin.kind === 'style') ?? open[open.length - 1]
  if (!pick) return null
  return {
    batchId: pick.id,
    found: pick.candidates.length,
    styleName: pick.origin.kind === 'style' ? pick.origin.styleName : null
  }
}
