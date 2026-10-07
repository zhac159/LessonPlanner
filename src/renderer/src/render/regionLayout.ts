/** Where a region's loop and number go in the pixels of a render (pure, unit-tested). */
import type { RenderJob, RenderRegion } from '@shared/annotate/renderJob'
import type { Point } from '@shared/annotate/types'

/** Size of the RegionLabel pill showing just a number: 22px disc, 4+10 padding, 2px border, 34px high. */
export const LABEL_SIZE = { width: 40, height: 34 } as const
/** The label's bottom edge sits this far above the loop's bounding box. */
export const LABEL_GAP = 6
/** ...and its left edge this share of the stage width to the left of the box. */
export const LABEL_INSET = 0.02

type View = Pick<RenderJob, 'viewport' | 'scale'>

/** A slide-unit point in the pixels of the image. */
export function toPixels([x, y]: Point, { viewport, scale }: View): Point {
  return [(x - viewport.x) * scale, (y - viewport.y) * scale]
}

/** SVG path data of a loop (closed) or a stroke (open) in image pixels. Empty for fewer than two points. */
export function pathData(path: readonly Point[], view: View, closed: boolean): string {
  if (path.length < 2) return ''
  const pixels = path.map((point) => toPixels(point, view))
  return `M ${pixels.map(([x, y]) => `${round(x)} ${round(y)}`).join(' L ')}${closed ? ' Z' : ''}`
}

const round = (value: number): number => Math.round(value * 100) / 100

/**
 * Top-left of the label in image pixels: bottom edge 6px above the loop's box, left edge 2% of the image
 * width left of it, kept inside the image (design-system "RegionOverlay + RegionLabel").
 */
export function labelPosition(
  region: Pick<RenderRegion, 'bbox'>,
  view: View,
  image: { width: number; height: number }
): { left: number; top: number } {
  const [boxX, boxY] = toPixels([region.bbox.x, region.bbox.y], view)
  const left = boxX - image.width * LABEL_INSET
  const top = boxY - LABEL_GAP - LABEL_SIZE.height
  return {
    left: Math.round(Math.min(Math.max(left, 0), Math.max(0, image.width - LABEL_SIZE.width))),
    top: Math.round(Math.min(Math.max(top, 0), Math.max(0, image.height - LABEL_SIZE.height)))
  }
}
