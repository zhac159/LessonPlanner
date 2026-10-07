/**
 * Image and speech-bubble parts of the writer's slide mapper (agents/ASSETS.md §4.2, §5.4): a named asset becomes a
 * library picture, anything else a picture spot with hints, and a callout's `tail` is checked against the known edges.
 */
import type { AssetCatalogue } from '@shared/ai/types'
import { fitIntoRegion } from '@shared/assets/fit'
import { ASSET_KINDS, type AssetKind } from '@shared/assets/types'
import { CALLOUT_TAILS } from '@shared/deck/schemaParts'
import type { CalloutTail, Element } from '@shared/deck/types'
import type { ElementBase, ElementWire } from './slide'

/** What the mapper may resolve names with (the teacher's library); without it every image is a picture spot. */
export type SlideAssets = Pick<AssetCatalogue, 'find'>

const humanise = (name: string): string => name.replace(/[_-]+/g, ' ').trim()

const spotKindOf = (value: string): AssetKind | undefined =>
  (ASSET_KINDS as readonly string[]).includes(value.trim().toLowerCase())
    ? (value.trim().toLowerCase() as AssetKind)
    : undefined

/** Kinds whose own frame is part of the picture: never rounded or re-framed. */
const KEEPS_FRAME: readonly AssetKind[] = ['logo', 'icon', 'symbol-card', 'diagram']

/**
 * An image: a library picture when `assetName` is known (the frame keeps the picture's shape, inside the box Claude
 * wrote; always an ordinary unlocked picture), otherwise a PICTURE SPOT (a placeholder with hints and no assetId).
 * An unknown name becomes a spot that carries the name as its description.
 */
export function toImage(wire: ElementWire, base: ElementBase, assets?: SlideAssets): Element {
  const assetName = wire.assetName?.trim() ?? ''
  const fact = assetName ? assets?.find(assetName) : undefined
  if (fact) {
    const box = fitIntoRegion(fact, { bbox: { x: base.x, y: base.y, w: base.w, h: base.h } }, 'fit')
    const { locked: _locked, ...open } = base
    return {
      ...open,
      type: 'image',
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      name: fact.name,
      assetId: fact.id,
      fit: 'contain',
      alt: fact.title,
      ...(wire.radius > 0 && !KEEPS_FRAME.includes(fact.kind) ? { radius: wire.radius } : {})
    }
  }
  const description =
    wire.description.trim() || humanise(assetName) || wire.alt.trim() || 'A picture'
  const kind = spotKindOf(wire.spotKind ?? '')
  const query = wire.spotQuery?.trim() ?? ''
  return {
    ...base,
    type: 'image',
    placeholder: { description, ...(kind ? { kind } : {}), ...(query ? { query } : {}) },
    fit: wire.fit,
    alt: wire.alt || description,
    ...(wire.radius > 0 ? { radius: wire.radius } : {})
  }
}

export const tailOf = (value: string): CalloutTail | undefined =>
  (CALLOUT_TAILS as readonly string[]).includes(value.trim())
    ? (value.trim() as CalloutTail)
    : undefined
