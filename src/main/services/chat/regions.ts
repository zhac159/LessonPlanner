/**
 * Circle to edit, main side (design/ai-pipeline.md §6): turns the regions and Draw-tool marks that arrive with a
 * chat message into what is stored (RegionChips) and what `chatTurn` needs: per region the annotated full-slide image (1280x720, the loop drawn
 * on it) and a close-up of its bounding box plus 10% padding at twice the pixel density.
 */
import { paddedCropBox } from '@shared/annotate/geometry'
import type { ChatTurnInput } from '@shared/ai/types'
import type { ChatRegion, RegionDraft, StrokePath } from '@shared/contracts/deck-builder-chat'
import { SLIDE_WIDTH, type Deck } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import type { SlideRendererPort } from '../lessons/types'

export const FULL_WIDTH = 1280
export const FULL_HEIGHT = 720
/** The close-up has twice the pixel density of the full image. */
const CROP_DENSITY = (FULL_WIDTH / SLIDE_WIDTH) * 2
export const MAX_REGIONS = 9
const CAPTION_LENGTH = 24

export type RegionPayload = NonNullable<ChatTurnInput['regions']>[number]

/** The sent message cut to about 24 characters at a word boundary, with "…" (06 §8.4). */
export function captionOf(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= CAPTION_LENGTH) return flat
  const cut = flat.slice(0, CAPTION_LENGTH + 1)
  const atWord = cut.lastIndexOf(' ')
  return `${(atWord > 0 ? cut.slice(0, atWord) : cut.slice(0, CAPTION_LENGTH)).trimEnd()}…`
}

export interface RegionInput {
  regions: readonly RegionDraft[]
  markup: ReadonlyArray<{ slideId: string; strokes: StrokePath[] }>
  deck: Deck
  style: StyleProfile | null
  renderer: SlideRendererPort
  readAsset(assetId: string): Promise<Uint8Array | undefined>
}

export interface RenderedRegions {
  /** For `chatTurn`. */
  payloads: RegionPayload[]
  /** Slides with marks but no region: told to Claude in words. */
  markedSlides: number[]
}

/** The regions as stored with the message (RegionChips). Regions on slides that no longer exist are dropped. */
export function describeRegions(
  regions: readonly RegionDraft[],
  deck: Pick<Deck, 'slides'>,
  text: string
): ChatRegion[] {
  const caption = captionOf(text)
  return [...regions]
    .sort((a, b) => a.n - b.n)
    .flatMap((region) => {
      const index = deck.slides.findIndex((s) => s.id === region.slideId)
      return index === -1
        ? []
        : [
            {
              n: region.n,
              slideId: region.slideId,
              slideNumber: index + 1,
              path: region.path,
              caption
            }
          ]
    })
}

/** Renders every region. Regions on slides that no longer exist are dropped. Throws when rendering fails. */
export async function renderRegions(input: RegionInput): Promise<RenderedRegions> {
  const { deck, renderer } = input
  const payloads: RegionPayload[] = []
  for (const region of [...input.regions].sort((a, b) => a.n - b.n)) {
    const index = deck.slides.findIndex((s) => s.id === region.slideId)
    if (index === -1) continue
    const slide = deck.slides[index]
    const onSlide = new Set(slide.elements.map((e) => e.id))
    const strokes = input.markup.filter((m) => m.slideId === slide.id).flatMap((m) => m.strokes)
    const common = { slide, style: input.style, readAsset: input.readAsset }
    const crop = paddedCropBox(region.bbox)
    const [annotatedPng, cropPng] = await Promise.all([
      renderer.renderSlidePng({
        ...common,
        width: FULL_WIDTH,
        height: FULL_HEIGHT,
        marks: [{ n: region.n, path: region.path }],
        strokes
      }),
      renderer.renderSlidePng({
        ...common,
        width: Math.round(crop.w * CROP_DENSITY),
        height: Math.round(crop.h * CROP_DENSITY),
        crop
      })
    ])
    payloads.push({
      n: region.n,
      slideId: slide.id,
      slideNumber: index + 1,
      annotatedPng,
      cropPng,
      targetElementIds: region.targetElementIds.filter((id) => onSlide.has(id)),
      bbox: region.bbox
    })
  }
  const withRegion = new Set(payloads.map((r) => r.slideId))
  const markedSlides = [
    ...new Set(input.markup.filter((m) => m.strokes.length > 0).map((m) => m.slideId))
  ]
    .filter((id) => !withRegion.has(id))
    .map((id) => deck.slides.findIndex((s) => s.id === id) + 1)
    .filter((n) => n > 0)
  return { payloads, markedSlides }
}
