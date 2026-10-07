/** Plain polygon and box geometry for circled regions (slide units). */
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../deck/types'
import type { Box, Point } from './types'

/** Loops smaller than this (either side of the bounding box) are clicks, not circles (06-editor §8.4). */
export const MIN_LOOP_SIZE = 40
/** Paths shorter than this are clicks too. */
export const MIN_LOOP_LENGTH = 120
/** The crop sent to Claude is the bounding box plus this fraction on every side. */
export const CROP_PADDING = 0.1
/** The crop never gets smaller than this, so a thin loop still shows its surroundings. */
export const MIN_CROP_SIZE = 96

/** The polygon's vertices with a repeated closing point removed. */
export function ring(path: readonly Point[]): Point[] {
  const last = path.length - 1
  if (last > 0 && path[0][0] === path[last][0] && path[0][1] === path[last][1]) {
    return path.slice(0, last)
  }
  return path.slice()
}

/** Signed shoelace area of a ring (positive when clockwise on screen, where y points down). */
function signedArea(points: readonly Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    sum += x1 * y2 - x2 * y1
  }
  return sum / 2
}

/**
 * Area enclosed by the path (shoelace formula, closing edge implied). A path that crosses itself counts
 * each part by its winding, so a figure of eight cancels out; fewer than 3 points have no area.
 */
export function polygonArea(path: readonly Point[]): number {
  const points = ring(path)
  return points.length < 3 ? 0 : Math.abs(signedArea(points))
}

/** Area of a box (never negative). */
export const boxArea = (box: Box): number => Math.max(0, box.w) * Math.max(0, box.h)

/** The smallest box containing every point (all zeros for an empty path). */
export function polygonBoundingBox(path: readonly Point[]): Box {
  if (path.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of path) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Length of the path including the closing edge. */
export function pathLength(path: readonly Point[]): number {
  const points = ring(path)
  let total = 0
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    total += Math.hypot(x2 - x1, y2 - y1)
  }
  return total
}

/**
 * True for a scribble too small to be a circle: bounding box under 40x40 units or a path under 120
 * units long. The editor treats it as a click and discards it.
 */
export function isTinyLoop(path: readonly Point[]): boolean {
  const box = polygonBoundingBox(path)
  return (box.w < MIN_LOOP_SIZE && box.h < MIN_LOOP_SIZE) || pathLength(path) < MIN_LOOP_LENGTH
}

/** Clamps a box into the slide, keeping its size where it fits and shrinking it where it cannot. */
export function clampToSlide(box: Box): Box {
  const w = Math.min(Math.max(box.w, 0), SLIDE_WIDTH)
  const h = Math.min(Math.max(box.h, 0), SLIDE_HEIGHT)
  return {
    x: Math.min(Math.max(box.x, 0), SLIDE_WIDTH - w),
    y: Math.min(Math.max(box.y, 0), SLIDE_HEIGHT - h),
    w,
    h
  }
}

/**
 * The area Claude gets as a close-up: the bounding box plus 10% of its size on every side, at least
 * 96 units each way, moved/clamped to lie inside the slide. Values are rounded to whole units.
 */
export function paddedCropBox(
  bbox: Box,
  padding: number = CROP_PADDING,
  minSize: number = MIN_CROP_SIZE
): Box {
  const w = Math.max(bbox.w * (1 + 2 * padding), minSize)
  const h = Math.max(bbox.h * (1 + 2 * padding), minSize)
  const padded = clampToSlide({
    x: bbox.x + bbox.w / 2 - w / 2,
    y: bbox.y + bbox.h / 2 - h / 2,
    w,
    h
  })
  const x = Math.round(padded.x)
  const y = Math.round(padded.y)
  return {
    x,
    y,
    w: Math.min(Math.round(padded.x + padded.w), SLIDE_WIDTH) - x,
    h: Math.min(Math.round(padded.y + padded.h), SLIDE_HEIGHT) - y
  }
}
