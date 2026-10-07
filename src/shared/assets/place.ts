/**
 * Placing an asset on a slide: where it goes (a circled area, a picture spot, a corner or a box), how it is
 * scaled, and the ops that make it ONE undo step (agents/ASSETS.md §5). Pure; main builds the ChangeSet with
 * these and the editor draws the live preview with the same `resolvePlacement`.
 */
import type { Point } from '../annotate/types'
import type { Box } from '../deck/layout'
import type { DeckOp, ImageElement, Slide } from '../deck/types'
import { appendCreditLine } from './credits'
import { anchoredBox, fitIntoRegion, type FitMode, type ImageSize, type PlacedBox } from './fit'
import { isPictureSpot } from './spots'
import type { Anchor } from './types'

/** Which asset to place: one already in the library, or one to save first (picked online / just made). */
export type AssetSourceRef =
  | { kind: 'library'; assetId: string }
  | { kind: 'online'; resultId: string; name?: string }
  | { kind: 'made'; jobId: string; version: number; name?: string }

/** Where on the slide. */
export type PlaceTarget =
  | {
      kind: 'region'
      /** The circle, in slide units. */
      path: Point[]
      bbox: Box
      /** The picture under the circle to swap (null: add a new element); the UI defaults to `underlyingPicture`. */
      replaceElementId: string | null
    }
  | { kind: 'spot'; elementId: string }
  | { kind: 'anchor'; anchor: Anchor; widthUnits?: number }
  | { kind: 'box'; box: Box }

/** What `deck-builder` `placeAsset` takes (agents/ASSETS.md §4.2). */
export interface PlaceAssetArgs {
  lessonId: string
  slideId: string
  source: AssetSourceRef
  target: PlaceTarget
  fit: FitMode
}

export interface Placement {
  box: PlacedBox
  /** The existing image element to update (spots and swapped pictures), or null to add a new one. */
  replaceElementId: string | null
}

/**
 * Works out the frame for a picture. A `spot` target needs the slide to find the spot's box; an unknown or
 * non-image `replaceElementId` is ignored (a new element is added instead). Locked elements are never replaced.
 */
export function resolvePlacement(
  slide: Slide,
  image: ImageSize,
  target: PlaceTarget,
  fit: FitMode
): Placement | { error: string } {
  const replaceable = (id: string | null | undefined): ImageElement | undefined => {
    const element = id ? slide.elements.find((e) => e.id === id) : undefined
    return element?.type === 'image' && !element.locked ? element : undefined
  }
  switch (target.kind) {
    case 'region': {
      const replace = replaceable(target.replaceElementId)
      return {
        box: fitIntoRegion(image, { bbox: target.bbox, path: target.path }, fit),
        replaceElementId: replace?.id ?? null
      }
    }
    case 'spot': {
      const spot = replaceable(target.elementId)
      if (!spot || !isPictureSpot(spot))
        return { error: 'That picture spot is not on this slide any more.' }
      const bbox = { x: spot.x, y: spot.y, w: spot.w, h: spot.h }
      return { box: fitIntoRegion(image, { bbox }, fit), replaceElementId: spot.id }
    }
    case 'anchor':
      return { box: anchoredBox(image, target.anchor, target.widthUnits), replaceElementId: null }
    case 'box':
      return { box: fitIntoRegion(image, { bbox: target.box }, fit), replaceElementId: null }
  }
}

export interface PlaceOpsInput {
  slide: Slide
  placement: Placement
  /** The lesson-folder id of the file (the library asset's own id: copy-on-use keeps it). */
  assetId: string
  alt: string
  /** The asset's chat name, kept on the element so the AI can say "the school_logo". */
  name: string
  /** Id for a newly added element (ignored when replacing). */
  newElementId: string
  /** The credit line to add to the slide's speaker notes, when the licence asks for one. */
  creditLine?: string | null
}

/** The ops for one placement: update the spot / swapped picture in place, or add a new image element. */
export function buildPlaceOps(input: PlaceOpsInput): DeckOp[] {
  const { slide, placement, assetId, alt, name, newElementId, creditLine } = input
  const { box, replaceElementId } = placement
  const frame = { x: box.x, y: box.y, w: box.w, h: box.h, fit: box.fit }
  const ops: DeckOp[] = replaceElementId
    ? [
        {
          op: 'updateElement',
          slideId: slide.id,
          elementId: replaceElementId,
          // The spot's `placeholder` stays as provenance; `assetId` is what makes it a picture.
          set: { ...frame, assetId, alt, name }
        }
      ]
    : [
        {
          op: 'addElement',
          slideId: slide.id,
          element: { id: newElementId, type: 'image', ...frame, assetId, alt, name }
        }
      ]
  if (creditLine) {
    const notes = appendCreditLine(slide.notes, creditLine)
    if (notes !== slide.notes) ops.push({ op: 'updateSlide', slideId: slide.id, set: { notes } })
  }
  return ops
}
