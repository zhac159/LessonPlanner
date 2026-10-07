/**
 * Picture spots: image elements Claude left empty ("A leaf in sunlight, close up"). A spot is an ImageElement
 * with a `placeholder` and no `assetId`; it is an editor-only mark and never exports (agents/ASSETS.md §2.3).
 */
import type { Element, ImageElement, Slide } from '../deck/types'
import type { Box } from '../deck/layout'
import type { AssetKind, PictureSpotInfo } from './types'

/** An image element that is still waiting for a picture. */
export const isPictureSpot = (element: Element): element is ImageElement =>
  element.type === 'image' && !element.assetId && !!element.placeholder

/** The spot's description and hints, tolerant of old decks whose placeholder only has a description. */
export function spotInfo(element: ImageElement): PictureSpotInfo {
  const raw = (element.placeholder ?? { description: element.alt }) as Partial<PictureSpotInfo>
  return {
    description: raw.description ?? element.alt,
    ...(raw.kind ? { kind: raw.kind as AssetKind } : {}),
    ...(raw.query ? { query: raw.query } : {}),
    ...(raw.suggestedAssets?.length ? { suggestedAssets: raw.suggestedAssets } : {})
  }
}

/** One empty spot, with its place in the lesson ("slide 3 · 1 of 3"). */
export interface SpotRef {
  slideId: string
  /** 1-based slide number. */
  slideNumber: number
  elementId: string
  description: string
  kind: AssetKind | null
  /** What to search online for: the hint, else the description. */
  query: string
  suggestedAssets: string[]
  box: Box
  /** 1-based position among all spots of the lesson, in slide order. */
  index: number
  total: number
}

/** Every empty spot in the lesson, slide by slide, top-most element first within a slide. */
export function listPictureSpots(slides: readonly Slide[]): SpotRef[] {
  const found: Omit<SpotRef, 'index' | 'total'>[] = []
  slides.forEach((slide, slideIndex) => {
    for (const element of slide.elements) {
      if (!isPictureSpot(element)) continue
      const info = spotInfo(element)
      found.push({
        slideId: slide.id,
        slideNumber: slideIndex + 1,
        elementId: element.id,
        description: info.description,
        kind: info.kind ?? null,
        query: info.query ?? info.description,
        suggestedAssets: info.suggestedAssets ?? [],
        box: { x: element.x, y: element.y, w: element.w, h: element.h }
      })
    }
  })
  return found.map((spot, i) => ({ ...spot, index: i + 1, total: found.length }))
}

export const countPictureSpots = (slides: readonly Slide[]): number =>
  slides.reduce((sum, slide) => sum + slide.elements.filter(isPictureSpot).length, 0)

/** Spots per slide number (1-based): the little dashed counters on the filmstrip. */
export function spotsPerSlide(slides: readonly Slide[]): Map<number, number> {
  const counts = new Map<number, number>()
  slides.forEach((slide, i) => {
    const n = slide.elements.filter(isPictureSpot).length
    if (n > 0) counts.set(i + 1, n)
  })
  return counts
}

/**
 * The spot to open next in "Place it · next spot" / "Skip". `spots` is the list AFTER the action and `index`
 * the 1-based index the current spot had BEFORE it: a filled spot leaves the list (the next one slides into
 * its index), a skipped spot stays (the next index follows). Wraps to the first; undefined when none are left.
 */
export function nextSpot(
  spots: readonly SpotRef[],
  index: number,
  action: 'filled' | 'skipped'
): SpotRef | undefined {
  if (spots.length === 0) return undefined
  const at = action === 'filled' ? index - 1 : index
  return spots[at % spots.length]
}
