import { describe, expect, it } from 'vitest'
import { polygonArea } from './geometry'
import { RDP_TOLERANCE, cleanPath, simplifyPath } from './simplify'
import type { Point } from './types'

/** Points along a closed polygon, `perEdge` samples on each edge (start included, end not repeated). */
function sampled(corners: Point[], perEdge: number): Point[] {
  const out: Point[] = []
  corners.forEach(([x1, y1], i) => {
    const [x2, y2] = corners[(i + 1) % corners.length]
    for (let k = 0; k < perEdge; k += 1) {
      out.push([x1 + ((x2 - x1) * k) / perEdge, y1 + ((y2 - y1) * k) / perEdge])
    }
  })
  return out
}

const circle = (r: number, count: number, cx = 500, cy = 500): Point[] =>
  Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Point
  })

function distanceToPolygon(p: Point, polygon: Point[]): number {
  let best = Infinity
  polygon.forEach(([x1, y1], i) => {
    const [x2, y2] = polygon[(i + 1) % polygon.length]
    const dx = x2 - x1
    const dy = y2 - y1
    const t = Math.max(0, Math.min(1, ((p[0] - x1) * dx + (p[1] - y1) * dy) / (dx * dx + dy * dy)))
    best = Math.min(best, Math.hypot(p[0] - (x1 + t * dx), p[1] - (y1 + t * dy)))
  })
  return best
}

describe('cleanPath', () => {
  it('drops non-finite points, consecutive duplicates and a repeated closing point', () => {
    const cleaned = cleanPath([
      [0, 0],
      [0, 0],
      [Number.NaN, 5],
      [10, 0],
      [Infinity, 1],
      [10, 10],
      [0, 0]
    ])
    expect(cleaned).toEqual([
      [0, 0],
      [10, 0],
      [10, 10]
    ])
  })

  it('does not change its input', () => {
    const input: Point[] = [
      [1, 1],
      [2, 2],
      [1, 1]
    ]
    cleanPath(input)
    expect(input).toHaveLength(3)
  })
})

describe('simplifyPath', () => {
  it('uses a tolerance of 4 units by default', () => {
    expect(RDP_TOLERANCE).toBe(4)
  })

  it('reduces a densely sampled rectangle to its corners', () => {
    const corners: Point[] = [
      [100, 100],
      [600, 100],
      [600, 400],
      [100, 400]
    ]
    const result = simplifyPath(sampled(corners, 50))
    expect(result).toHaveLength(4)
    expect(result).toEqual(expect.arrayContaining(corners))
    expect(polygonArea(result)).toBeCloseTo(500 * 300)
  })

  it('does not treat the start point as special: a loop started mid-edge keeps its shape', () => {
    const corners: Point[] = [
      [350, 100],
      [600, 100],
      [600, 400],
      [100, 400],
      [100, 100]
    ]
    const result = simplifyPath(sampled(corners, 40))
    expect(result.length).toBeLessThanOrEqual(5)
    expect(polygonArea(result)).toBeCloseTo(500 * 300)
  })

  it('keeps every original point within the tolerance of the result', () => {
    const noisy = circle(300, 400).map(([x, y], i) => [x + Math.sin(i) * 1.5, y] as Point)
    const result = simplifyPath(noisy)
    expect(result.length).toBeLessThan(noisy.length / 4)
    expect(result.length).toBeGreaterThanOrEqual(8)
    for (const point of noisy) {
      expect(distanceToPolygon(point, result)).toBeLessThanOrEqual(RDP_TOLERANCE + 1e-9)
    }
  })

  it('returns the polygon open: the first point is not repeated at the end', () => {
    const path = [...circle(200, 60), circle(200, 60)[0]]
    const result = simplifyPath(path)
    expect(result[result.length - 1]).not.toEqual(result[0])
    expect(result.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps more detail with a smaller tolerance', () => {
    const wobbly = circle(300, 200)
    expect(simplifyPath(wobbly, 0.5).length).toBeGreaterThan(simplifyPath(wobbly, 20).length)
  })

  it('keeps all corners of a coarse path when the tolerance is zero', () => {
    const path: Point[] = [
      [0, 0],
      [10, 3],
      [20, 0],
      [20, 20],
      [0, 20]
    ]
    expect(simplifyPath(path, 0)).toHaveLength(5)
  })

  it('collapses a straight scribble to two points (zero area)', () => {
    const line: Point[] = Array.from({ length: 30 }, (_, i) => [i * 10, i * 5] as Point)
    const result = simplifyPath(line)
    expect(result).toHaveLength(2)
    expect(polygonArea(result)).toBe(0)
  })

  it('returns dots and two-point paths as they are', () => {
    expect(simplifyPath([])).toEqual([])
    expect(simplifyPath([[5, 5]])).toEqual([[5, 5]])
    expect(
      simplifyPath([
        [5, 5],
        [5, 5],
        [5, 5]
      ])
    ).toEqual([[5, 5]])
    expect(
      simplifyPath([
        [0, 0],
        [9, 9]
      ])
    ).toEqual([
      [0, 0],
      [9, 9]
    ])
  })

  it('simplifies a self-intersecting figure of eight without failing', () => {
    const eight: Point[] = []
    for (let i = 0; i < 200; i += 1) {
      const t = (i / 200) * Math.PI * 2
      eight.push([500 + 200 * Math.sin(t), 400 + 100 * Math.sin(2 * t)])
    }
    const result = simplifyPath(eight)
    expect(result.length).toBeGreaterThanOrEqual(4)
    expect(result.length).toBeLessThan(eight.length)
  })

  it('handles a very long pointer path (no recursion limit)', () => {
    const long = circle(400, 50_000)
    expect(simplifyPath(long).length).toBeLessThan(200)
  })

  it('ignores invalid points in the middle of a path', () => {
    const path: Point[] = [...circle(200, 100)]
    path.splice(10, 0, [Number.NaN, Number.NaN])
    expect(simplifyPath(path).length).toBeGreaterThanOrEqual(8)
  })
})
