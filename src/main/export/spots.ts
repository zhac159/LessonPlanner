/**
 * Picture spots and export (agents/ASSETS.md §6): spots never export, so before anything is saved the caller asks
 * `exportSpotsStatus` and, when it answers, shows the "N picture spots are still empty" dialog instead of the Save dialog.
 */
import { countPictureSpots, spotsPerSlide } from '@shared/assets/spots'
import type { Deck } from '@shared/deck/types'

/** The `spots` variant of the editor's ExportResult: nothing was saved, she has to answer first. */
export interface ExportSpotsStatus {
  status: 'spots'
  count: number
  /** 1-based numbers of the slides that still have an empty spot, in order. */
  slides: number[]
}

/** `null` when the lesson has no empty picture spot (or she chose "Export anyway": check `ignoreSpots` first). */
export function exportSpotsStatus(deck: Pick<Deck, 'slides'>): ExportSpotsStatus | null {
  const count = countPictureSpots(deck.slides)
  if (count === 0) return null
  return { status: 'spots', count, slides: [...spotsPerSlide(deck.slides).keys()] }
}
