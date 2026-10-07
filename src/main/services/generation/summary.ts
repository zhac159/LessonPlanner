/**
 * The words a finished generation adds to its assistant message about pictures (agents/ASSETS.md §3.12, §5.4):
 * "I used {{school_logo}} on the title slide and {{leaf_cross_section}} on slide 5." and, when pictures are still
 * missing, the sentence that points at the picture spots. Pure; main writes them itself so they are always true.
 */
import { listPictureSpots } from '@shared/assets/spots'
import type { ChatAssetRef } from '@shared/assets/types'
import type { Slide } from '@shared/deck/types'
import { libraryOf, sanitiseAssistantTokens } from '../chat/assetTokens'
import type { LessonAssetsPort } from '../lessons/assetsPort'

export const SPOT_SENTENCE =
  'Where a picture would help and you don’t have one yet, I’ve left a **picture spot**. Click one to fill it.'

/** A slide that was written in this run, with its place in the deck. */
export interface MadeSlide {
  /** 1-based position in the deck. */
  number: number
  slide: Slide
}

const joinWords = (parts: string[]): string =>
  parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`

function where(numbers: number[], kinds: string[], all: boolean): string {
  if (all && numbers.length > 1) return 'every slide'
  if (numbers.length === 1) return kinds[0] === 'title' ? 'the title slide' : `slide ${numbers[0]}`
  return `slides ${joinWords(numbers.map(String))}`
}

/**
 * "I used {{a}} on the title slide and {{b}} on slide 5." for the library pictures on the slides just written,
 * or '' when there are none. `nameOf` gives an asset's current name (undefined = gone: it is left out).
 */
export function usedAssetsSentence(
  made: readonly MadeSlide[],
  nameOf: (assetId: string) => string | undefined
): string {
  const uses = new Map<string, { numbers: number[]; kinds: string[] }>()
  for (const { number, slide } of made) {
    for (const element of slide.elements) {
      if (element.type !== 'image' || !element.assetId) continue
      const use = uses.get(element.assetId) ?? { numbers: [], kinds: [] }
      if (!use.numbers.includes(number)) {
        use.numbers.push(number)
        use.kinds.push(slide.kind)
      }
      uses.set(element.assetId, use)
    }
  }
  const phrases = [...uses].flatMap(([assetId, use]) => {
    const name = nameOf(assetId)
    return name
      ? [`{{${name}}} on ${where(use.numbers, use.kinds, use.numbers.length === made.length)}`]
      : []
  })
  return phrases.length ? `I used ${joinWords(phrases)}.` : ''
}

/** The sentence about the spots just left, or '' when there are none (or the text already says it). */
export function spotsSentence(slides: readonly Slide[], text: string): string {
  return listPictureSpots(slides).length > 0 && !/picture spot/i.test(text) ? SPOT_SENTENCE : ''
}

/** Her summary, then the pictures used, then the spot sentence on its own line. */
export function withPictureNotes(summary: string, used: string, spots: string): string {
  const first = [summary.trim(), summary.includes('{{') ? '' : used].filter(Boolean).join(' ')
  return [first, spots].filter(Boolean).join('\n\n')
}

/**
 * The assistant message a finished generation stores and streams: her summary, which assets were used and, when
 * pictures are missing, the sentence about the picture spots. `deckSlides` is the lesson after the commit (it gives
 * the slide numbers); tokens are checked against the library, so a made-up name never becomes a chip.
 */
export function finishText(
  summary: string,
  made: readonly Slide[],
  deckSlides: readonly Slide[],
  library: Pick<LessonAssetsPort, 'get' | 'list'>
): { text: string; assets: ChatAssetRef[]; showSpots: boolean } {
  const ids = new Set(made.map((slide) => slide.id))
  const placed = deckSlides.flatMap((slide, at) =>
    ids.has(slide.id) ? [{ number: at + 1, slide }] : []
  )
  const raw = withPictureNotes(
    summary,
    usedAssetsSentence(placed, (id) => library.get(id)?.name),
    spotsSentence(made, summary)
  )
  const clean = sanitiseAssistantTokens(
    raw,
    libraryOf(() => library.list())
  )
  return { text: clean.text, assets: clean.refs, showSpots: listPictureSpots(made).length > 0 }
}
