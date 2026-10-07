/** Circled regions in the chat: the Composer's chips and the chips of sent messages (06 §8.4). */
import type { ChatRegion, RegionDraft } from '@shared/contracts/deck-builder-chat'
import type { Deck } from '@shared/deck/types'

const CAPTION_LENGTH = 24

/** One chip in the Composer: the RegionChip props a draft can fill, plus the draft's id. */
export interface DraftChip {
  id: string
  n: number
  slideNumber: number
}

/** The message cut to about 24 characters at a word boundary, with "…" (06 §8.4 step 11). */
export function captionOf(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= CAPTION_LENGTH) return flat
  const cut = flat.slice(0, CAPTION_LENGTH + 1)
  const atWord = cut.lastIndexOf(' ')
  return `${(atWord > 0 ? cut.slice(0, atWord) : cut.slice(0, CAPTION_LENGTH)).trimEnd()}…`
}

/** 1-based number of a slide in the deck, or null when it is gone. */
export function slideNumberOf(deck: Pick<Deck, 'slides'>, slideId: string): number | null {
  const index = deck.slides.findIndex((slide) => slide.id === slideId)
  return index < 0 ? null : index + 1
}

/** Drafts waiting in the Composer, as chips. A draft whose slide was deleted is dropped by the editor. */
export function draftChips(
  regions: readonly RegionDraft[],
  deck: Pick<Deck, 'slides'>
): DraftChip[] {
  return [...regions]
    .sort((a, b) => a.n - b.n)
    .map((region) => ({
      id: region.id,
      n: region.n,
      slideNumber: slideNumberOf(deck, region.slideId) ?? 1
    }))
}

/** What the optimistic copy of a just-sent message stores for its regions. */
export function sentRegions(
  regions: readonly RegionDraft[],
  deck: Pick<Deck, 'slides'>,
  text: string
): ChatRegion[] {
  const caption = captionOf(text)
  return [...regions]
    .sort((a, b) => a.n - b.n)
    .flatMap((region) => {
      const slideNumber = slideNumberOf(deck, region.slideId)
      return slideNumber === null
        ? []
        : [{ n: region.n, slideId: region.slideId, slideNumber, path: region.path, caption }]
    })
}
