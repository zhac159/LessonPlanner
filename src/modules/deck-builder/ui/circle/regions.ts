/**
 * Circle to edit, pure part of the drawing layer: turning a finished loop into a numbered
 * `RegionDraft` and finding the region under a click (design/screens/06-editor.md §8.4).
 */
import {
  isTinyLoop,
  polygonArea,
  polygonBoundingBox,
  simplifyPath,
  targetElementIds
} from '@shared/annotate'
import type { RegionDraft, StrokePath } from '@shared/contracts/deck-builder-chat'
import type { Slide } from '@shared/deck/types'

/** The most circles one message may carry (06 §8.4 step 6). */
export const MAX_REGIONS = 9

/** The next number: one more than the highest in use, across all slides; numbers are never reused. */
export function nextRegionNumber(regions: ReadonlyArray<Pick<RegionDraft, 'n'>>): number {
  return regions.reduce((highest, region) => Math.max(highest, region.n), 0) + 1
}

/**
 * Simplifies a raw pointer loop (Ramer-Douglas-Peucker, tolerance 4) and returns it, or null when it
 * is a dot, a straight line or too small to be a circle: the caller treats that as a click.
 */
export function closeLoop(points: StrokePath): StrokePath | null {
  const path = simplifyPath(points)
  return path.length < 3 || isTinyLoop(path) ? null : path
}

/** Everything the chat needs about a finished loop: its number, box and the elements under it. */
export function buildRegion(args: {
  slide: Slide
  path: StrokePath
  existing: ReadonlyArray<Pick<RegionDraft, 'n'>>
  id: string
}): RegionDraft {
  const { slide, path, existing, id } = args
  return {
    id,
    n: nextRegionNumber(existing),
    slideId: slide.id,
    path,
    bbox: polygonBoundingBox(path),
    targetElementIds: targetElementIds(slide, { path })
  }
}

/** Ray casting: is `point` inside the polygon `path`? */
export function pointInPath(point: [number, number], path: StrokePath): boolean {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = path.length - 1; i < path.length; j = i, i += 1) {
    const [xi, yi] = path[i]
    const [xj, yj] = path[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** The region whose loop holds `point`; the smallest one wins when loops are nested. */
export function regionAt<R extends Pick<RegionDraft, 'path'>>(
  point: [number, number],
  regions: readonly R[]
): R | null {
  const hits = regions.filter((region) => pointInPath(point, region.path))
  hits.sort((a, b) => polygonArea(a.path) - polygonArea(b.path))
  return hits[0] ?? null
}

/** A fresh id for a draft region. */
export const newRegionId = (): string => `region-${crypto.randomUUID()}`
