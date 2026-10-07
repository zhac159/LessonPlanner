/** Turns "a slide at this width" or "a crop of this box" into the viewport and scale of a render job. */
import { MAX_RENDER_PIXELS, MAX_RENDER_SCALE, MIN_RENDER_SCALE } from '@shared/annotate/renderJob'
import { paddedCropBox } from '@shared/annotate/geometry'
import type { Box } from '@shared/annotate/types'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@shared/deck/types'
import { DEFAULT_RENDER_WIDTH } from './port'

/** Smallest image width worth rendering. */
export const MIN_RENDER_WIDTH = 16
/** A crop has this many times the pixel density of a full slide image. */
export const CROP_DENSITY = 2

export interface RenderPlan {
  /** Part of the slide to draw, in slide units. */
  viewport: Box
  /** Pixels per slide unit. */
  scale: number
}

/** Throws a RangeError unless `width` is a whole number of pixels the renderer accepts. */
export function assertRenderWidth(width: number, label = 'width'): number {
  if (!Number.isInteger(width) || width < MIN_RENDER_WIDTH || width > MAX_RENDER_PIXELS) {
    throw new RangeError(
      `Render ${label} must be a whole number from ${MIN_RENDER_WIDTH} to ${MAX_RENDER_PIXELS}, got ${width}`
    )
  }
  return width
}

/** The whole slide at `width` pixels across. */
export function planSlide(width: number = DEFAULT_RENDER_WIDTH): RenderPlan {
  return {
    viewport: { x: 0, y: 0, w: SLIDE_WIDTH, h: SLIDE_HEIGHT },
    scale: assertRenderWidth(width) / SLIDE_WIDTH
  }
}

/**
 * The bounding box plus 10% padding (clamped to the slide), at twice the pixel density of a full slide
 * image of `width`. The density is capped so the image never exceeds the renderer's size limits.
 */
export function planCrop(bbox: Box, width: number = DEFAULT_RENDER_WIDTH): RenderPlan {
  const viewport = paddedCropBox(bbox)
  const wanted = (CROP_DENSITY * assertRenderWidth(width)) / SLIDE_WIDTH
  const longest = Math.max(viewport.w, viewport.h)
  return { viewport, scale: Math.min(wanted, MAX_RENDER_SCALE, MAX_RENDER_PIXELS / longest) }
}

/** The part of `box` that lies on the slide, in whole slide units (zero-sized when it misses the slide). */
function intersectWithSlide(box: Box): Box {
  const left = Math.max(0, box.x)
  const top = Math.max(0, box.y)
  const right = Math.min(SLIDE_WIDTH, box.x + box.w)
  const bottom = Math.min(SLIDE_HEIGHT, box.y + box.h)
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) }
}

/**
 * Any part of the slide scaled to fit `width` x `height` (just `width` when no height is given). Throws a
 * RangeError when the part is empty or the result would be larger than the renderer allows.
 */
export function planView(viewport: Box, width: number, height?: number): RenderPlan {
  const part = intersectWithSlide(viewport)
  if (!(part.w > 0 && part.h > 0)) throw new RangeError('The part of the slide to render is empty')
  assertRenderWidth(width)
  if (height !== undefined) assertRenderWidth(height, 'height')
  const scale = Math.min(width / part.w, height === undefined ? Infinity : height / part.h)
  const longest = Math.max(part.w, part.h) * scale
  if (scale < MIN_RENDER_SCALE || scale > MAX_RENDER_SCALE || longest > MAX_RENDER_PIXELS) {
    throw new RangeError(
      `Cannot render ${part.w}x${part.h} units at ${width}px wide (scale ${scale})`
    )
  }
  return { viewport: part, scale }
}
