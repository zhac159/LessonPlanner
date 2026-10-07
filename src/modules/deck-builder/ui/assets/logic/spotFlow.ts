/** The order of work in "Fill a picture spot" (agents/ASSETS.md §3.13): a snapshot, "k of N" and the next spot. Pure. */
import { nextSpot, type SpotRef } from '@shared/assets/spots'

/** "“A leaf in sunlight, close up” · slide 3 · 1 of 3": the subtitle of the A13 band. */
export function spotSubtitle(
  spot: Pick<SpotRef, 'description' | 'slideNumber'>,
  k: number,
  n: number
): string {
  return `“${spot.description}” · slide ${spot.slideNumber} · ${k} of ${n}`
}

/** Where `elementId` stands in the snapshot taken when the sheet opened (1-based), and how many there were. */
export function snapshotPosition(
  snapshot: readonly string[],
  elementId: string
): { k: number; n: number } {
  const at = snapshot.indexOf(elementId)
  return at < 0
    ? { k: snapshot.length + 1, n: snapshot.length + 1 }
    : { k: at + 1, n: snapshot.length }
}

/**
 * The spot to open after the current one. `live` is the list of empty spots NOW (after a fill, without it).
 * Filled: the next one in slide order, wrapping. Skipped: the next one, but skipping the last one closes (null).
 */
export function spotAfter(
  live: readonly SpotRef[],
  current: Pick<SpotRef, 'index' | 'total'>,
  action: 'filled' | 'skipped'
): SpotRef | null {
  if (action === 'skipped' && current.index >= current.total) return null
  return nextSpot(live, current.index, action) ?? null
}

/** The primary button of A13: "Place it · next spot", or just "Place it" on the last empty spot. */
export const placeLabel = (remaining: number): string =>
  remaining > 1 ? 'Place it · next spot' : 'Place it'
