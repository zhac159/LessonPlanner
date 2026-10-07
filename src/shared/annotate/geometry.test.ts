import { describe, expect, it } from 'vitest'
import {
  boxArea,
  clampToSlide,
  isTinyLoop,
  paddedCropBox,
  pathLength,
  polygonArea,
  polygonBoundingBox,
  ring
} from './geometry'
import type { Point } from './types'

const square = (x: number, y: number, size: number): Point[] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size]
]

describe('ring', () => {
  it('drops a repeated closing point and leaves open polygons alone', () => {
    expect(ring([...square(0, 0, 10), [0, 0]])).toHaveLength(4)
    expect(ring(square(0, 0, 10))).toHaveLength(4)
    expect(ring([])).toEqual([])
    expect(ring([[1, 1]])).toEqual([[1, 1]])
  })
})

describe('polygonArea', () => {
  it('is the area of a square, whichever way it is drawn', () => {
    expect(polygonArea(square(0, 0, 10))).toBe(100)
    expect(polygonArea([...square(0, 0, 10)].reverse())).toBe(100)
  })

  it('is the same with or without a repeated closing point', () => {
    expect(polygonArea([...square(5, 5, 20), [5, 5]])).toBe(400)
  })

  it('handles a concave L shape exactly', () => {
    const l: Point[] = [
      [0, 0],
      [20, 0],
      [20, 10],
      [10, 10],
      [10, 20],
      [0, 20]
    ]
    expect(polygonArea(l)).toBe(300)
  })

  it('is 0 for fewer than three points and for collinear points', () => {
    expect(polygonArea([])).toBe(0)
    expect(polygonArea([[1, 1]])).toBe(0)
    expect(
      polygonArea([
        [0, 0],
        [10, 10]
      ])
    ).toBe(0)
    expect(
      polygonArea([
        [0, 0],
        [5, 5],
        [10, 10]
      ])
    ).toBe(0)
  })

  it('cancels a symmetric figure of eight (net winding area)', () => {
    const bowTie: Point[] = [
      [0, 0],
      [10, 10],
      [10, 0],
      [0, 10]
    ]
    expect(polygonArea(bowTie)).toBe(0)
  })
})

describe('boxArea', () => {
  it('multiplies and never goes negative', () => {
    expect(boxArea({ x: 0, y: 0, w: 4, h: 5 })).toBe(20)
    expect(boxArea({ x: 0, y: 0, w: -4, h: 5 })).toBe(0)
  })
})

describe('polygonBoundingBox', () => {
  it('spans the extreme points', () => {
    expect(
      polygonBoundingBox([
        [10, 40],
        [300, 20],
        [150, 90]
      ])
    ).toEqual({ x: 10, y: 20, w: 290, h: 70 })
  })

  it('is empty for no points and a point for one point', () => {
    expect(polygonBoundingBox([])).toEqual({ x: 0, y: 0, w: 0, h: 0 })
    expect(polygonBoundingBox([[7, 9]])).toEqual({ x: 7, y: 9, w: 0, h: 0 })
  })
})

describe('pathLength and isTinyLoop', () => {
  it('measures the perimeter including the closing edge', () => {
    expect(pathLength(square(0, 0, 10))).toBe(40)
    expect(pathLength([...square(0, 0, 10), [0, 0]])).toBe(40)
  })

  it('treats small bounding boxes and short paths as clicks', () => {
    expect(isTinyLoop(square(100, 100, 30))).toBe(true)
    expect(isTinyLoop(square(100, 100, 25))).toBe(true)
    expect(isTinyLoop(square(100, 100, 200))).toBe(false)
    expect(
      isTinyLoop([
        [0, 0],
        [30, 0],
        [30, 20]
      ])
    ).toBe(true)
  })

  it('treats a long thin loop as a real loop only when it is long enough', () => {
    const thin: Point[] = [
      [0, 0],
      [300, 0],
      [300, 10],
      [0, 10]
    ]
    expect(isTinyLoop(thin)).toBe(false)
    expect(isTinyLoop([])).toBe(true)
  })
})

describe('clampToSlide', () => {
  it('moves a box back inside, keeping its size', () => {
    expect(clampToSlide({ x: -50, y: 1000, w: 200, h: 200 })).toEqual({
      x: 0,
      y: 880,
      w: 200,
      h: 200
    })
    expect(clampToSlide({ x: 1900, y: 10, w: 100, h: 100 })).toEqual({
      x: 1820,
      y: 10,
      w: 100,
      h: 100
    })
  })

  it('shrinks a box that is larger than the slide', () => {
    expect(clampToSlide({ x: -10, y: -10, w: 5000, h: 5000 })).toEqual({
      x: 0,
      y: 0,
      w: 1920,
      h: 1080
    })
  })
})

describe('paddedCropBox', () => {
  it('adds 10% of the size on every side', () => {
    expect(paddedCropBox({ x: 1000, y: 300, w: 500, h: 400 })).toEqual({
      x: 950,
      y: 260,
      w: 600,
      h: 480
    })
  })

  it('is clamped to the slide when the loop is near an edge', () => {
    const crop = paddedCropBox({ x: 0, y: 0, w: 500, h: 400 })
    expect(crop.x).toBe(0)
    expect(crop.y).toBe(0)
    expect(crop.w).toBeLessThanOrEqual(1920)
    const farCorner = paddedCropBox({ x: 1500, y: 800, w: 420, h: 280 })
    expect(farCorner.x + farCorner.w).toBeLessThanOrEqual(1920)
    expect(farCorner.y + farCorner.h).toBeLessThanOrEqual(1080)
    expect(farCorner.x + farCorner.w).toBe(1920)
    expect(farCorner.y + farCorner.h).toBe(1080)
  })

  it('never exceeds the slide for a full-slide loop', () => {
    expect(paddedCropBox({ x: 0, y: 0, w: 1920, h: 1080 })).toEqual({
      x: 0,
      y: 0,
      w: 1920,
      h: 1080
    })
  })

  it('grows a degenerate box to a minimum size around its centre', () => {
    const crop = paddedCropBox({ x: 800, y: 500, w: 0, h: 0 })
    expect(crop).toEqual({ x: 752, y: 452, w: 96, h: 96 })
  })

  it('returns whole units', () => {
    const crop = paddedCropBox({ x: 100.4, y: 200.6, w: 333.3, h: 111.1 })
    for (const value of Object.values(crop)) expect(Number.isInteger(value)).toBe(true)
  })

  it('accepts other padding', () => {
    expect(paddedCropBox({ x: 500, y: 500, w: 100, h: 100 }, 0, 0)).toEqual({
      x: 500,
      y: 500,
      w: 100,
      h: 100
    })
  })
})
