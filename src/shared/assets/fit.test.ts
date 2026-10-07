import { describe, expect, it } from 'vitest'
import type { Point } from '../annotate/types'
import type { ImageElement, Slide } from '../deck/types'
import {
  ANCHOR_MARGIN,
  FIT_INSET,
  anchoredBox,
  fitIntoRegion,
  polygonCentroid,
  polygonContains,
  regionIsUsable,
  underlyingPicture
} from './fit'

/** A closed loop approximating an ellipse. */
const loop = (cx: number, cy: number, rx: number, ry: number, n = 48): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)] as Point
  })

const bboxOf = (path: Point[]) => {
  const xs = path.map((p) => p[0])
  const ys = path.map((p) => p[1])
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys)
  }
}

const cornersInside = (path: Point[], box: { x: number; y: number; w: number; h: number }) =>
  [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h]
  ].every((corner) => polygonContains(path, corner as Point))

describe('polygonContains and polygonCentroid', () => {
  const square: Point[] = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100]
  ]
  it('tells inside from outside, with or without a repeated closing point', () => {
    expect(polygonContains(square, [50, 50])).toBe(true)
    expect(polygonContains(square, [150, 50])).toBe(false)
    expect(polygonContains([...square, [0, 0]], [50, 50])).toBe(true)
  })
  it('finds the centre of a polygon and null for a line', () => {
    expect(polygonCentroid(square)).toEqual([50, 50])
    expect(
      polygonCentroid([
        [0, 0],
        [10, 10]
      ])
    ).toBeNull()
  })
})

describe('fitIntoRegion · fit inside the circle', () => {
  const circle = loop(1200, 400, 200, 200)
  const region = { bbox: bboxOf(circle), path: circle }

  it('keeps the picture’s shape, centres it and keeps all four corners inside the loop', () => {
    const placed = fitIntoRegion({ width: 800, height: 600 }, region, 'fit')
    expect(placed.fit).toBe('contain')
    expect(placed.w / placed.h).toBeCloseTo(4 / 3, 1)
    expect(placed.x + placed.w / 2).toBeCloseTo(1200, -1)
    expect(placed.y + placed.h / 2).toBeCloseTo(400, -1)
    expect(cornersInside(circle, placed)).toBe(true)
    // The largest 4:3 rectangle in a circle of radius 200 is 320 wide; the inset takes a little off.
    expect(placed.w).toBeGreaterThan(290)
    expect(placed.w).toBeLessThanOrEqual(320)
    expect(FIT_INSET).toBeGreaterThan(0)
  })

  it('fits a square picture into a wide loop by its height', () => {
    const wide = loop(960, 540, 400, 150)
    const placed = fitIntoRegion(
      { width: 500, height: 500 },
      { bbox: bboxOf(wide), path: wide },
      'fit'
    )
    expect(placed.w).toBe(placed.h)
    expect(placed.h).toBeLessThanOrEqual(300)
    expect(cornersInside(wide, placed)).toBe(true)
  })

  it('stays inside an L-shaped loop (no dent pokes into the picture)', () => {
    const l: Point[] = [
      [100, 100],
      [500, 100],
      [500, 300],
      [300, 300],
      [300, 600],
      [100, 600]
    ]
    const placed = fitIntoRegion({ width: 200, height: 200 }, { bbox: bboxOf(l), path: l }, 'fit')
    expect(cornersInside(l, placed)).toBe(true)
    const [reflexX, reflexY] = [300, 300]
    const pokes =
      reflexX > placed.x &&
      reflexX < placed.x + placed.w &&
      reflexY > placed.y &&
      reflexY < placed.y + placed.h
    expect(pokes).toBe(false)
    expect(placed.w).toBeGreaterThan(100)
  })

  it('contains the picture in a plain box when there is no loop (a picture spot)', () => {
    const placed = fitIntoRegion(
      { width: 400, height: 200 },
      { bbox: { x: 1000, y: 200, w: 600, h: 600 } },
      'fit'
    )
    expect(placed).toMatchObject({ x: 1000, y: 350, w: 600, h: 300, fit: 'contain' })
  })

  it('falls back to the box for a degenerate or too thin loop', () => {
    const line: Point[] = [
      [0, 0],
      [100, 0],
      [200, 0]
    ]
    const flat = fitIntoRegion(
      { width: 100, height: 100 },
      { bbox: { x: 0, y: 0, w: 200, h: 10 }, path: line },
      'fit'
    )
    expect(flat.fit).toBe('contain')
    expect(flat.w).toBeGreaterThan(0)
    const thin = loop(500, 500, 300, 6)
    const thinFit = fitIntoRegion(
      { width: 100, height: 100 },
      { bbox: bboxOf(thin), path: thin },
      'fit'
    )
    expect(thinFit.w).toBeGreaterThan(0)
  })
})

describe('fitIntoRegion · fill the circle', () => {
  it('covers the loop’s bounding box, clamped to the slide', () => {
    const circle = loop(1200, 400, 200, 200)
    const placed = fitIntoRegion(
      { width: 800, height: 600 },
      { bbox: bboxOf(circle), path: circle },
      'fill'
    )
    expect(placed.fit).toBe('cover')
    expect(placed.x).toBe(1000)
    expect(placed.y).toBe(200)
    expect(placed.w).toBe(400)
    expect(placed.h).toBe(400)
  })

  it('moves a box that hangs off the slide back inside', () => {
    const placed = fitIntoRegion(
      { width: 100, height: 100 },
      { bbox: { x: 1800, y: 1000, w: 300, h: 200 } },
      'fill'
    )
    expect(placed.x + placed.w).toBeLessThanOrEqual(1920)
    expect(placed.y + placed.h).toBeLessThanOrEqual(1080)
  })
})

describe('low resolution flag', () => {
  const bbox = { x: 100, y: 100, w: 800, h: 600 }
  it('flags a small bitmap stretched large, never a vector', () => {
    expect(fitIntoRegion({ width: 200, height: 150 }, { bbox }, 'fit').lowResolution).toBe(true)
    expect(fitIntoRegion({ width: 1600, height: 1200 }, { bbox }, 'fit').lowResolution).toBe(false)
    expect(
      fitIntoRegion({ width: 200, height: 150, vector: true }, { bbox }, 'fit').lowResolution
    ).toBe(false)
  })
})

describe('anchoredBox', () => {
  const image = { width: 600, height: 400 }
  it('pins a corner with the margin and keeps the shape', () => {
    const topRight = anchoredBox(image, 'top-right', 300)
    expect(topRight).toMatchObject({
      x: 1920 - ANCHOR_MARGIN - 300,
      y: ANCHOR_MARGIN,
      w: 300,
      h: 200
    })
    const bottomLeft = anchoredBox(image, 'bottom-left', 300)
    expect(bottomLeft).toMatchObject({ x: ANCHOR_MARGIN, y: 1080 - ANCHOR_MARGIN - 200 })
  })
  it('centres on the axis it does not name and never leaves the slide', () => {
    const top = anchoredBox(image, 'top', 300)
    expect(top.x).toBe(810)
    const huge = anchoredBox(image, 'center', 5000)
    expect(huge.w).toBeLessThanOrEqual(1920 - 2 * ANCHOR_MARGIN)
    expect(huge.h).toBeLessThanOrEqual(1080 - 2 * ANCHOR_MARGIN)
    expect(anchoredBox(image, 'left').x).toBe(ANCHOR_MARGIN)
  })
})

describe('underlyingPicture', () => {
  const image = (id: string, over: Partial<ImageElement> = {}): ImageElement => ({
    id,
    type: 'image',
    x: 1000,
    y: 250,
    w: 600,
    h: 450,
    fit: 'cover',
    alt: 'Photo: leaf in sunlight',
    placeholder: { description: 'Photo: leaf in sunlight' },
    ...over
  })
  const slide = (elements: ImageElement[]): Slide => ({ id: 'sld_1', kind: 'content', elements })
  const circle = loop(1300, 475, 330, 240)

  it('finds the picture (or empty spot) a circle sits on', () => {
    expect(underlyingPicture(slide([image('el_a')]), { path: circle })?.id).toBe('el_a')
  })
  it('ignores locked pictures, tiny loops and slides without pictures', () => {
    expect(
      underlyingPicture(slide([image('el_a', { locked: true })]), { path: circle })
    ).toBeUndefined()
    expect(underlyingPicture(slide([image('el_a')]), { path: [[0, 0]] })).toBeUndefined()
    expect(underlyingPicture(slide([]), { path: circle })).toBeUndefined()
  })
  it('knows a loop is worth fitting into', () => {
    expect(regionIsUsable({ bbox: { x: 0, y: 0, w: 200, h: 200 } })).toBe(true)
    expect(regionIsUsable({ bbox: { x: 0, y: 0, w: 5, h: 5 } })).toBe(false)
  })
})
