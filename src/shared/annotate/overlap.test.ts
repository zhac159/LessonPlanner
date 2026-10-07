import { describe, expect, it } from 'vitest'
import { fixtureDeck, makeSlide, makeText } from '../deck/testing'
import type { Element, ShapeElement } from '../deck/types'
import { overlapOf, overlapRatio, targetElementIds, targetElements } from './overlap'
import type { Box, Point } from './types'

const rect = (x: number, y: number, w: number, h: number): Point[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h]
]
const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h })

describe('overlapRatio', () => {
  const element = box(100, 100, 200, 100)

  it('is 1 when the loop covers the whole element', () => {
    expect(overlapRatio(element, rect(0, 0, 1000, 1000))).toBe(1)
  })

  it('is 0 when they do not touch', () => {
    expect(overlapRatio(element, rect(500, 500, 100, 100))).toBe(0)
  })

  it('is the covered share of the element', () => {
    expect(overlapRatio(element, rect(0, 0, 200, 1000))).toBeCloseTo(0.5)
    expect(overlapRatio(element, rect(250, 150, 1000, 1000))).toBeCloseTo((50 * 50) / (200 * 100))
  })

  it('is exact for a triangle cutting the box diagonally', () => {
    const triangle: Point[] = [
      [100, 100],
      [300, 100],
      [100, 200]
    ]
    expect(overlapRatio(element, triangle)).toBeCloseTo(0.5)
  })

  it('works for a concave loop (a C shape that misses the middle of the element)', () => {
    const c: Point[] = [
      [0, 0],
      [400, 0],
      [400, 300],
      [0, 300],
      [0, 220],
      [350, 220],
      [350, 80],
      [0, 80]
    ]
    // The box 100..300 x 100..200 sits inside the C's hollow: nothing of it is covered.
    expect(overlapRatio(element, c)).toBeCloseTo(0)
    // A box straddling the lower arm (y 220..300) is covered where the arm is.
    expect(overlapRatio(box(100, 180, 200, 100), c)).toBeCloseTo(0.6)
  })

  it('is the same whichever way the loop is drawn and whether or not it repeats its start', () => {
    const loop = rect(0, 0, 200, 1000)
    expect(overlapRatio(element, [...loop].reverse())).toBeCloseTo(0.5)
    expect(overlapRatio(element, [...loop, loop[0]])).toBeCloseTo(0.5)
  })

  it('is 0 for degenerate loops (empty, a point, a line, collinear points)', () => {
    expect(overlapRatio(element, [])).toBe(0)
    expect(overlapRatio(element, [[150, 150]])).toBe(0)
    expect(
      overlapRatio(element, [
        [100, 100],
        [300, 200]
      ])
    ).toBe(0)
    expect(
      overlapRatio(element, [
        [100, 150],
        [200, 150],
        [300, 150]
      ])
    ).toBe(0)
  })

  it('does not fail for an element without area (a line has no height)', () => {
    const line = box(100, 100, 200, 0)
    expect(overlapRatio(line, rect(0, 0, 1000, 1000))).toBe(1)
    expect(overlapRatio(box(100, 100, 0, 0), rect(0, 0, 1000, 1000))).toBe(1)
  })

  it('copes with a self-intersecting loop', () => {
    const loop: Point[] = [
      [0, 0],
      [300, 0],
      [300, 300],
      [0, 300],
      [0, 100],
      [150, 100],
      [150, 250],
      [50, 250]
    ]
    const ratio = overlapRatio(box(0, 0, 300, 300), loop)
    expect(ratio).toBeGreaterThan(0)
    expect(ratio).toBeLessThanOrEqual(1)
  })
})

describe('overlapOf', () => {
  it('also reports how much of the loop is inside the element', () => {
    const result = overlapOf(box(0, 0, 1000, 1000), rect(100, 100, 100, 100))
    expect(result.contained).toBe(1)
    expect(result.coverage).toBeCloseTo(0.01)
  })

  it('takes rotation into account', () => {
    const wide = box(400, 450, 400, 100) // centre (600, 500)
    // Rotated 90 degrees it becomes a tall bar x 550..650, y 300..700.
    const tallSlot = rect(550, 300, 100, 400)
    expect(overlapOf(wide, tallSlot, 90).coverage).toBeCloseTo(1)
    expect(overlapOf(wide, tallSlot, 0).coverage).toBeCloseTo(0.25)
  })
})

describe('targetElements', () => {
  const photo: Element = {
    id: 'photo',
    type: 'image',
    x: 1100,
    y: 300,
    w: 700,
    h: 500,
    fit: 'cover',
    alt: 'A leaf'
  }
  const title = makeText('title', 'Photosynthesis', { x: 100, y: 100, w: 1600, h: 100 })
  const band: ShapeElement = {
    id: 'band',
    type: 'shape',
    shape: 'rect',
    x: 0,
    y: 0,
    w: 30,
    h: 1080,
    locked: true
  }

  it('targets the elements at least 30% inside the loop', () => {
    const slide = makeSlide('s1', { elements: [photo] })
    expect(targetElementIds(slide, { path: rect(1050, 250, 400, 600) })).toEqual(['photo'])
    // 25% of the photo (700 x 500) is inside this loop, which is mostly outside it: not enough.
    expect(targetElementIds(slide, { path: rect(500, 100, 950, 450) })).toEqual([])
    // 36% is.
    expect(targetElementIds(slide, { path: rect(500, 100, 950, 560) })).toEqual(['photo'])
  })

  it('targets an element when the loop lies mostly inside it, however small', () => {
    const slide = makeSlide('s1', { elements: [photo] })
    expect(targetElementIds(slide, { path: rect(1200, 400, 100, 100) })).toEqual(['photo'])
  })

  it('does not target the element when only a sliver of the loop overlaps it', () => {
    const slide = makeSlide('s1', { elements: [photo] })
    expect(targetElementIds(slide, { path: rect(1700, 700, 400, 400) })).toEqual([])
  })

  it('sorts by how much of each element is covered, then by what is on top', () => {
    const a = makeText('a', 'A', { x: 0, y: 0, w: 100, h: 100 })
    const b = makeText('b', 'B', { x: 0, y: 0, w: 100, h: 100 })
    const half = makeText('half', 'H', { x: 100, y: 0, w: 100, h: 100 })
    const slide = makeSlide('s1', { elements: [half, a, b] })
    // Loop: covers a and b entirely and 60% of "half".
    expect(targetElementIds(slide, { path: rect(0, 0, 160, 100) })).toEqual(['b', 'a', 'half'])
  })

  it('lets z-order decide between equal overlaps', () => {
    const low = makeText('low', 'L', { x: 0, y: 0, w: 100, h: 100, z: 5 })
    const high = makeText('high', 'H', { x: 0, y: 0, w: 100, h: 100, z: 1 })
    const slide = makeSlide('s1', { elements: [low, high] })
    expect(targetElementIds(slide, { path: rect(0, 0, 100, 100) })).toEqual(['low', 'high'])
  })

  it('leaves out locked decorations when anything else is hit', () => {
    const slide = makeSlide('s1', { elements: [band, title] })
    expect(targetElementIds(slide, { path: rect(0, 0, 1000, 1100) })).toEqual(['title'])
  })

  it('returns a locked decoration when it is the only hit', () => {
    const slide = makeSlide('s1', { elements: [band, title] })
    expect(targetElementIds(slide, { path: rect(0, 400, 60, 300) })).toEqual(['band'])
  })

  it('returns elements themselves, and nothing for an empty slide or a degenerate loop', () => {
    const slide = makeSlide('s1', { elements: [photo] })
    expect(targetElements(slide, { path: rect(1100, 300, 700, 500) })).toEqual([photo])
    expect(targetElements(makeSlide('s2'), { path: rect(0, 0, 500, 500) })).toEqual([])
    expect(targetElements(slide, { path: [] })).toEqual([])
    expect(
      targetElements(slide, {
        path: [
          [1100, 300],
          [1800, 800]
        ]
      })
    ).toEqual([])
  })

  it('hit-tests rotated elements in their rotated position', () => {
    const bar = makeText('bar', 'Bar', { x: 400, y: 450, w: 400, h: 100, rotation: 90 })
    const slide = makeSlide('s1', { elements: [bar] })
    expect(targetElementIds(slide, { path: rect(550, 300, 100, 400) })).toEqual(['bar'])
    expect(targetElementIds(slide, { path: rect(400, 450, 110, 100) })).toEqual([])
  })

  it('finds the photo on slide 3 of the photosynthesis fixture when the loop circles it', () => {
    const slide = fixtureDeck().slides[2]
    expect(targetElementIds(slide, { path: rect(1075, 300, 790, 550) })).toEqual(['s3-photo'])
  })

  it('finds two elements when one loop circles both, most covered first', () => {
    const slide = fixtureDeck().slides[2]
    const loop = rect(100, 280, 1760, 560)
    const ids = targetElementIds(slide, { path: loop })
    expect(ids).toEqual(expect.arrayContaining(['s3-heading', 's3-los', 's3-keywords', 's3-photo']))
    expect(ids).not.toContain('s3-band')
    expect(ids).not.toContain('s3-title')
  })
})
