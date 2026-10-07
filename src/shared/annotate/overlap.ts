/** Hit-testing a circled region against the elements of a slide (design/ai-pipeline.md §6 step 2). */
import type { Element, Slide } from '../deck/types'
import { boxArea, polygonArea, ring } from './geometry'
import type { Box, Point, Region } from './types'

/** An element is targeted when at least this share of its area lies inside the loop. */
export const COVERAGE_THRESHOLD = 0.3
/** ...or when at least this share of the loop lies inside the element ("mostly inside"). */
export const CONTAINED_THRESHOLD = 0.5
/** Hairline elements (a line has no height) are hit-tested as if at least this thick. */
const MIN_THICKNESS = 8

/** How an element and a region overlap. */
export interface Overlap {
  /** Share of the element's area that is inside the loop, 0..1. */
  coverage: number
  /** Share of the loop's area that is inside the element, 0..1. */
  contained: number
}

/** Sutherland-Hodgman clip of a polygon against one half-plane. */
function clipHalfPlane(
  points: Point[],
  inside: (p: Point) => boolean,
  cross: (a: Point, b: Point) => Point
): Point[] {
  const out: Point[] = []
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const previous = points[(i + points.length - 1) % points.length]
    if (inside(current)) {
      if (!inside(previous)) out.push(cross(previous, current))
      out.push(current)
    } else if (inside(previous)) {
      out.push(cross(previous, current))
    }
  }
  return out
}

/** The part of `polygon` that lies inside an axis-aligned box (area is exact for concave loops too). */
function clipToBox(polygon: Point[], box: Box): Point[] {
  const left = box.x
  const right = box.x + box.w
  const top = box.y
  const bottom = box.y + box.h
  const atX = (a: Point, b: Point, x: number): Point => [
    x,
    a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])
  ]
  const atY = (a: Point, b: Point, y: number): Point => [
    a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]),
    y
  ]
  let points = clipHalfPlane(
    polygon,
    (p) => p[0] >= left,
    (a, b) => atX(a, b, left)
  )
  points = clipHalfPlane(
    points,
    (p) => p[0] <= right,
    (a, b) => atX(a, b, right)
  )
  points = clipHalfPlane(
    points,
    (p) => p[1] >= top,
    (a, b) => atY(a, b, top)
  )
  return clipHalfPlane(
    points,
    (p) => p[1] <= bottom,
    (a, b) => atY(a, b, bottom)
  )
}

/** Turns the polygon into the element's own (unrotated) frame, so a rotated element is a plain box. */
function intoElementFrame(polygon: Point[], box: Box, rotationDeg: number): Point[] {
  if (!rotationDeg) return polygon
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return polygon.map(([x, y]) => [
    cx + (x - cx) * cos + (y - cy) * sin,
    cy - (x - cx) * sin + (y - cy) * cos
  ])
}

/** The element's box, thickened to a minimum so a zero-height line can still be circled. */
function hitBox(box: Box): Box {
  const w = Math.max(box.w, MIN_THICKNESS)
  const h = Math.max(box.h, MIN_THICKNESS)
  return { x: box.x - (w - box.w) / 2, y: box.y - (h - box.h) / 2, w, h }
}

/**
 * How much of `box` (optionally rotated about its centre, in degrees) the polygon covers, and how much of
 * the polygon is inside the box. Both are 0 for a polygon without area.
 */
export function overlapOf(box: Box, polygon: readonly Point[], rotationDeg = 0): Overlap {
  const loop = ring(polygon)
  const loopArea = polygonArea(loop)
  const target = hitBox(box)
  if (loopArea === 0 || boxArea(target) === 0) return { coverage: 0, contained: 0 }
  const inside = polygonArea(clipToBox(intoElementFrame(loop, box, rotationDeg), target))
  return {
    coverage: Math.min(1, inside / boxArea(target)),
    contained: Math.min(1, inside / loopArea)
  }
}

/** Share (0..1) of the element box's area that lies inside the polygon. */
export function overlapRatio(elementBox: Box, polygon: readonly Point[]): number {
  return overlapOf(elementBox, polygon).coverage
}

/** True when the overlap makes the element a target of the region. */
export const isTargeted = ({ coverage, contained }: Overlap): boolean =>
  coverage >= COVERAGE_THRESHOLD || contained >= CONTAINED_THRESHOLD

/**
 * The elements a region is about, best match first. An element is targeted when at least 30% of its area
 * is inside the loop, or when the loop lies mostly (>= 50%) inside the element. Sorted by coverage, then
 * by how much of the loop it holds, then top-most first. Locked decorations (the style's band) are left
 * out unless they are the only hit, so circling the empty background still tells Claude something.
 */
export function targetElements(slide: Slide, region: Pick<Region, 'path'>): Element[] {
  const hits = slide.elements
    .map((element, index) => ({
      element,
      index,
      ...overlapOf(element, region.path, element.rotation)
    }))
    .filter(isTargeted)
    .sort(
      (a, b) =>
        b.coverage - a.coverage ||
        b.contained - a.contained ||
        (b.element.z ?? 0) - (a.element.z ?? 0) ||
        b.index - a.index
    )
  const unlocked = hits.filter((hit) => !hit.element.locked)
  return (unlocked.length > 0 ? unlocked : hits).map((hit) => hit.element)
}

/** Ids of `targetElements`, for the `RegionDraft` sent with a message. */
export const targetElementIds = (slide: Slide, region: Pick<Region, 'path'>): string[] =>
  targetElements(slide, region).map((element) => element.id)
