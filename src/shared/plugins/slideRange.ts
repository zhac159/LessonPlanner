/** Resolves a `slideRange` input ("All / Selected / This slide") to slides. Pure. */
import type { Deck, Slide } from '../deck/types'
import type { PluginSelection } from './types'

export type SlideRangeValue = 'all' | 'selected' | 'current'

/** The slides a range means, in deck order. Unknown ids are ignored; a stale selection yields nothing. */
export function resolveSlides(
  deck: Pick<Deck, 'slides'>,
  range: SlideRangeValue,
  selection: Pick<PluginSelection, 'currentSlideId' | 'selectedSlideIds'>
): Slide[] {
  if (range === 'all') return deck.slides
  const wanted = new Set(
    range === 'current' ? [selection.currentSlideId] : selection.selectedSlideIds
  )
  return deck.slides.filter((slide) => wanted.has(slide.id))
}

/** Checks the editor's selection against the deck: ids that do not exist are dropped, order is the deck's. */
export function normaliseSelection(
  deck: Pick<Deck, 'slides'>,
  raw: { currentSlideId: string; selectedSlideIds: string[] }
): Pick<PluginSelection, 'currentSlideId' | 'selectedSlideIds'> {
  const ids = new Set(deck.slides.map((s) => s.id))
  const current = ids.has(raw.currentSlideId) ? raw.currentSlideId : (deck.slides[0]?.id ?? '')
  const picked = new Set(raw.selectedSlideIds.filter((id) => ids.has(id)))
  const selected = deck.slides.map((s) => s.id).filter((id) => picked.has(id))
  return {
    currentSlideId: current,
    selectedSlideIds: selected.length > 0 ? selected : current ? [current] : []
  }
}
