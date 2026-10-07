/**
 * Scaling a picture to a circled area, a picture spot or a corner (slide units, 1920 x 1080).
 * The editor draws the live preview and main writes the ChangeSet with the SAME numbers (agents/ASSETS.md §5.5).
 *   fit  = the whole picture, never cropped, entirely inside the circle (contain)
 *   fill = the picture covers the circle's bounding box, cropped to it (cover)
 * Pure: no DOM, no Node.
 */
import { boxArea, clampToSlide, polygonArea, polygonBoundingBox, ring } from '../annotate/geometry'
import { targetElements } from '../annotate/overlap'
import type { Box, Point } from '../annotate/types'
import type { ImageElement, Slide } from '../deck/types'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../deck/types'
import type { Anchor } from './types'

export type FitMode = 'fit' | 'fill'

/** The picture's own size (pixels, or the SVG viewBox). */
export interface ImageSize {
  width: number
  height: number
  vector?: boolean
}

/** A circled area: its bounding box, and the loop itself when it is not a rectangle (spots have no path). */
export interface FitRegion {
  bbox: Box
  path?: readonly Point[]
}

/** The element frame to write, plus how the picture sits in it. */
export interface PlacedBox extends Box {
  fit: ImageElement['fit']
  /** Source pixels per slide unit at this size (1 = a 1920 px wide picture across the slide). */
  density: number
  /** True when the picture would be stretched past ~half its pixels: the sheet shows a "may look blurry" note. */
  lowResolution: boolean
}

/** Below this many source pixels per slide unit the picture is flagged (a 960 px picture across a full slide). */
export const LOW_RESOLUTION_DENSITY = 0.5
/** Breathing room kept between a fitted picture and the circle's line. */
export const FIT_INSET = 6
/** The smallest edge a placed picture may have. */
export const MIN_PLACED_SIZE = 16
/** Default corner margin and width used for chat placements such as "top right". */
export const ANCHOR_MARGIN = 48
export const DEFAULT_ANCHOR_WIDTH = 240

const BINARY_STEPS = 24
const EDGE_SAMPLES = 8

/** Ray-casting point-in-polygon (boundary points count as inside for our purposes). */
export function polygonContains(path: readonly Point[], [px, py]: Point): boolean {
  const points = ring(path)
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** The area-weighted centre of a polygon, or null when it has no area. */
export function polygonCentroid(path: readonly Point[]): Point | null {
  const points = ring(path)
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    const cross = x1 * y2 - x2 * y1
    area += cross
    cx += (x1 + x2) * cross
    cy += (y1 + y2) * cross
  }
  if (Math.abs(area) < 1e-6) return null
  return [cx / (3 * area), cy / (3 * area)]
}

function rectInside(points: Point[], cx: number, cy: number, w: number, h: number, inset: number) {
  const left = cx - w / 2 - inset
  const right = cx + w / 2 + inset
  const top = cy - h / 2 - inset
  const bottom = cy + h / 2 + inset
  for (let i = 0; i <= EDGE_SAMPLES; i += 1) {
    const t = i / EDGE_SAMPLES
    const x = left + (right - left) * t
    const y = top + (bottom - top) * t
    if (
      !polygonContains(points, [x, top]) ||
      !polygonContains(points, [x, bottom]) ||
      !polygonContains(points, [left, y]) ||
      !polygonContains(points, [right, y])
    ) {
      return false
    }
  }
  // A dent in the loop that pokes into the rectangle: a vertex strictly inside it.
  return !points.some(
    ([x, y]) => x > left + 0.5 && x < right - 0.5 && y > top + 0.5 && y < bottom - 0.5
  )
}

/** The largest width (at aspect `aw:ah`) of a rectangle centred on `centre` that stays inside the polygon. */
function largestWidthAt(
  points: Point[],
  centre: Point,
  aspect: number,
  maxWidth: number,
  inset: number
) {
  const [cx, cy] = centre
  if (!polygonContains(points, centre)) return 0
  let lo = 0
  let hi = maxWidth
  for (let step = 0; step < BINARY_STEPS; step += 1) {
    const mid = (lo + hi) / 2
    if (rectInside(points, cx, cy, mid, mid / aspect, inset)) lo = mid
    else hi = mid
  }
  return lo
}

/** Centres worth trying: the loop's centroid, its bounding-box centre and a 3 x 3 grid inside the box. */
function candidateCentres(points: Point[], bbox: Box): Point[] {
  const centres: Point[] = []
  const centroid = polygonCentroid(points)
  if (centroid) centres.push(centroid)
  centres.push([bbox.x + bbox.w / 2, bbox.y + bbox.h / 2])
  for (const fx of [0.3, 0.5, 0.7]) {
    for (const fy of [0.3, 0.5, 0.7]) centres.push([bbox.x + bbox.w * fx, bbox.y + bbox.h * fy])
  }
  return centres
}

const round = (value: number): number => Math.round(value)

function finish(box: Box, fit: ImageElement['fit'], image: ImageSize): PlacedBox {
  const clamped = clampToSlide(box)
  const w = Math.max(MIN_PLACED_SIZE, round(clamped.w))
  const h = Math.max(MIN_PLACED_SIZE, round(clamped.h))
  const density = Math.min(image.width / w, image.height / h)
  return {
    x: round(clamped.x),
    y: round(clamped.y),
    w,
    h,
    fit,
    density,
    lowResolution: !image.vector && density < LOW_RESOLUTION_DENSITY
  }
}

/** The largest box of the picture's shape inside a plain rectangle, centred. */
function containInBox(image: ImageSize, bbox: Box): Box {
  const scale = Math.min(bbox.w / image.width, bbox.h / image.height)
  const w = image.width * scale
  const h = image.height * scale
  return { x: bbox.x + (bbox.w - w) / 2, y: bbox.y + (bbox.h - h) / 2, w, h }
}

/**
 * Scales `image` to `region`.
 * - `fit`: the largest rectangle with the picture's own shape that lies entirely inside the loop (with a small
 *   inset), so nothing is cropped and nothing crosses her circle; a plain box (a spot) is simply contained.
 * - `fill`: the loop's bounding box, clamped to the slide; the element uses `cover`, so the picture is cropped to it.
 */
export function fitIntoRegion(image: ImageSize, region: FitRegion, mode: FitMode): PlacedBox {
  const bbox = clampToSlide(region.bbox)
  if (mode === 'fill') return finish(bbox, 'cover', image)

  const aspect = image.width / image.height
  const path = region.path ? ring(region.path) : []
  if (path.length < 3 || polygonArea(path) < 1) {
    return finish(containInBox(image, bbox), 'contain', image)
  }

  const loopBox = polygonBoundingBox(path)
  const maxWidth = Math.min(loopBox.w, loopBox.h * aspect)
  let best: { width: number; centre: Point } | null = null
  for (const centre of candidateCentres(path, loopBox)) {
    const width = largestWidthAt(path, centre, aspect, maxWidth, FIT_INSET)
    if (!best || width > best.width + 0.5) best = { width, centre }
  }
  if (!best || best.width < MIN_PLACED_SIZE) {
    // A loop too thin to hold the picture: fall back to its box so something sensible still appears.
    return finish(containInBox(image, bbox), 'contain', image)
  }
  const w = best.width
  const h = w / aspect
  return finish({ x: best.centre[0] - w / 2, y: best.centre[1] - h / 2, w, h }, 'contain', image)
}

/** The box of a picture of `width` units (aspect kept) pinned to a corner, edge or centre of the slide. */
export function anchoredBox(
  image: ImageSize,
  anchor: Anchor,
  widthUnits: number = DEFAULT_ANCHOR_WIDTH,
  margin: number = ANCHOR_MARGIN
): PlacedBox {
  const maxW = SLIDE_WIDTH - 2 * margin
  const maxH = SLIDE_HEIGHT - 2 * margin
  const width = Math.min(widthUnits, maxW, maxH * (image.width / image.height))
  const w = Math.max(MIN_PLACED_SIZE, width)
  const h = Math.max(MIN_PLACED_SIZE, w * (image.height / image.width))
  const x = anchor.endsWith('left')
    ? margin
    : anchor.endsWith('right')
      ? SLIDE_WIDTH - margin - w
      : (SLIDE_WIDTH - w) / 2
  const y = anchor.startsWith('top')
    ? margin
    : anchor.startsWith('bottom')
      ? SLIDE_HEIGHT - margin - h
      : (SLIDE_HEIGHT - h) / 2
  return finish({ x, y, w, h }, 'contain', image)
}

/**
 * The picture under a circle that "Replace what's underneath" would swap: the best-covered image element
 * (a filled picture or an empty picture spot), never text or a locked decoration.
 */
export function underlyingPicture(
  slide: Slide,
  region: { path: readonly Point[] }
): ImageElement | undefined {
  if (region.path.length < 3) return undefined
  const hit = targetElements(slide, { path: region.path as Point[] }).find(
    (element) => element.type === 'image' && !element.locked
  )
  return hit?.type === 'image' ? hit : undefined
}

/** True when the circle is big enough to be worth fitting something into (not a speck). */
export const regionIsUsable = (region: FitRegion): boolean =>
  boxArea(region.bbox) >= MIN_PLACED_SIZE * MIN_PLACED_SIZE
