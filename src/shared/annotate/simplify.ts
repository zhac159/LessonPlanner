/** Capturing a circled path: clean it up and reduce it to a few vertices. */
import type { Point } from './types'

/** Ramer-Douglas-Peucker tolerance in slide units (design/ai-pipeline.md §6). */
export const RDP_TOLERANCE = 4

const samePoint = (a: Point, b: Point): boolean => a[0] === b[0] && a[1] === b[1]

/** Distance from `p` to the segment `a`-`b`. */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/** Classic RDP on an open polyline (iterative, so a long pointer path cannot overflow the stack). */
function rdp(points: Point[], tolerance: number): Point[] {
  const last = points.length - 1
  if (last < 2) return points.slice()
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[last] = 1
  const stack: Array<[number, number]> = [[0, last]]
  while (stack.length > 0) {
    const [from, to] = stack.pop() as [number, number]
    let worst = -1
    let worstDistance = tolerance
    for (let i = from + 1; i < to; i += 1) {
      const d = distanceToSegment(points[i], points[from], points[to])
      if (d > worstDistance) {
        worst = i
        worstDistance = d
      }
    }
    if (worst >= 0) {
      keep[worst] = 1
      stack.push([from, worst], [worst, to])
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

/** Drops non-finite points and consecutive duplicates, and a last point equal to the first. */
export function cleanPath(path: readonly Point[]): Point[] {
  const clean: Point[] = []
  for (const point of path) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue
    if (clean.length > 0 && samePoint(clean[clean.length - 1], point)) continue
    clean.push([point[0], point[1]])
  }
  if (clean.length > 1 && samePoint(clean[0], clean[clean.length - 1])) clean.pop()
  return clean
}

/**
 * Closes and simplifies a pointer path with Ramer-Douglas-Peucker. The path is treated as a loop (its
 * end joins its start), so the loop is cut at the point farthest from the start and both halves are
 * simplified: the start point is not special. Returns the polygon without a repeated end point; fewer
 * than 3 vertices means the path was a dot or a straight line (the caller discards it as a click).
 */
export function simplifyPath(path: readonly Point[], tolerance: number = RDP_TOLERANCE): Point[] {
  const points = cleanPath(path)
  if (points.length < 3) return points
  let farthest = 1
  let farthestDistance = -1
  for (let i = 1; i < points.length; i += 1) {
    const d = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1])
    if (d > farthestDistance) {
      farthest = i
      farthestDistance = d
    }
  }
  const firstHalf = rdp(points.slice(0, farthest + 1), tolerance)
  const secondHalf = rdp([...points.slice(farthest), points[0]], tolerance)
  return [...firstHalf, ...secondHalf.slice(1, -1)]
}
