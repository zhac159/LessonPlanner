import type { StrokePath } from '@shared/contracts/deck-builder-chat'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@shared/deck/types'

/** The overlay's box on screen, in CSS pixels (from `getBoundingClientRect`). */
export interface ClientBox {
  left: number
  top: number
  width: number
  height: number
}

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/**
 * Maps a pointer position to slide units (1920 x 1080), clamped to the slide. With `scale` (pixels
 * per slide unit) the box only supplies the origin; without it the box's own width and height are
 * used, so the result is the same at any displayed size.
 */
export function clientToSlide(
  clientX: number,
  clientY: number,
  box: ClientBox,
  scale?: number
): [number, number] {
  const unitsX = scale && scale > 0 ? (clientX - box.left) / scale : null
  const unitsY = scale && scale > 0 ? (clientY - box.top) / scale : null
  const x = unitsX ?? (box.width > 0 ? ((clientX - box.left) / box.width) * SLIDE_WIDTH : 0)
  const y = unitsY ?? (box.height > 0 ? ((clientY - box.top) / box.height) * SLIDE_HEIGHT : 0)
  return [clamp(x, 0, SLIDE_WIDTH), clamp(y, 0, SLIDE_HEIGHT)]
}

const round = (value: number): number => Math.round(value * 10) / 10

/** SVG path data through the points: `M x y L x y …`, plus `Z` when closed. Empty for no points. */
export function pathData(path: StrokePath, closed = false): string {
  if (path.length === 0) return ''
  const body = path
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`)
    .join(' ')
  return closed ? `${body} Z` : body
}

/** Path data for the whole slide with a hole shaped like the region, filled with `evenodd`. */
export function dimOutsideData(path: StrokePath): string {
  const slide = `M0 0 H${SLIDE_WIDTH} V${SLIDE_HEIGHT} H0 Z`
  return path.length < 3 ? slide : `${slide} ${pathData(path, true)}`
}

/** The smallest box around the points; null for no points. */
export function boundsOf(path: StrokePath): Bounds | null {
  if (path.length === 0) return null
  const xs = path.map(([x]) => x)
  const ys = path.map(([, y]) => y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/** Largest left position (percent) that still leaves room for a label of about a quarter width. */
const MAX_LABEL_LEFT = 76

/**
 * Where a region's label sits, in percent of the stage: pinned above the top-left corner of the
 * region's box, 2% of the stage width to the left of it, kept inside the stage (06 §8.4).
 * The label is lifted by its own height plus 6px in CSS.
 */
export function labelPlacement(bounds: Bounds): { left: number; top: number } {
  return {
    left: clamp((bounds.x / SLIDE_WIDTH) * 100 - 2, 0, MAX_LABEL_LEFT),
    top: clamp((bounds.y / SLIDE_HEIGHT) * 100, 0, 100)
  }
}

/** Point reached by a keyboard step, kept inside the slide. */
export function movePoint(point: [number, number], dx: number, dy: number): [number, number] {
  return [clamp(point[0] + dx, 0, SLIDE_WIDTH), clamp(point[1] + dy, 0, SLIDE_HEIGHT)]
}
