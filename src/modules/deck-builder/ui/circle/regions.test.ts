import { describe, expect, it } from 'vitest'
import { makeSlide, makeText } from '@shared/deck/testing'
import type { StrokePath } from '@shared/contracts/deck-builder-chat'
import { buildRegion, closeLoop, nextRegionNumber, pointInPath, regionAt } from './regions'

const square = (x: number, y: number, size: number): StrokePath => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size]
]

describe('nextRegionNumber', () => {
  it('starts at 1', () => expect(nextRegionNumber([])).toBe(1))
  it('uses the highest number plus one and never reuses a gap', () => {
    expect(nextRegionNumber([{ n: 1 }, { n: 3 }])).toBe(4)
  })
})

describe('closeLoop', () => {
  it('discards a dot, a line and a tiny loop', () => {
    expect(closeLoop([[10, 10]])).toBeNull()
    expect(
      closeLoop([
        [0, 0],
        [500, 0]
      ])
    ).toBeNull()
    expect(closeLoop(square(100, 100, 20))).toBeNull()
  })

  it('simplifies a dense loop and keeps its shape', () => {
    const dense: StrokePath = []
    for (let i = 0; i <= 100; i += 1) dense.push([100 + i * 4, 100])
    for (let i = 1; i <= 100; i += 1) dense.push([500, 100 + i * 3])
    for (let i = 1; i <= 100; i += 1) dense.push([500 - i * 4, 400])
    for (let i = 1; i < 100; i += 1) dense.push([100, 400 - i * 3])
    const path = closeLoop(dense)
    expect(path).not.toBeNull()
    expect(path!.length).toBeLessThan(10)
    expect(path!.length).toBeGreaterThanOrEqual(4)
  })
})

describe('buildRegion', () => {
  const slide = makeSlide('s3', {
    elements: [
      makeText('title', 'Title', { x: 100, y: 100, w: 400, h: 100 }),
      makeText('body', 'Body', { x: 1000, y: 300, w: 600, h: 400 })
    ]
  })

  it('numbers the region, boxes it and lists the elements under it', () => {
    const region = buildRegion({
      slide,
      path: square(950, 250, 800),
      existing: [{ n: 2 }],
      id: 'r1'
    })
    expect(region).toMatchObject({ id: 'r1', n: 3, slideId: 's3' })
    expect(region.bbox).toEqual({ x: 950, y: 250, w: 800, h: 800 })
    expect(region.targetElementIds).toEqual(['body'])
  })

  it('has no targets when the loop circles empty space', () => {
    const region = buildRegion({ slide, path: square(1200, 800, 300), existing: [], id: 'r2' })
    expect(region.targetElementIds).toEqual([])
  })
})

describe('hit testing', () => {
  it('knows what is inside a polygon', () => {
    expect(pointInPath([50, 50], square(0, 0, 100))).toBe(true)
    expect(pointInPath([150, 50], square(0, 0, 100))).toBe(false)
  })

  it('prefers the smallest loop when loops are nested', () => {
    const big = { id: 'big', path: square(0, 0, 400) }
    const small = { id: 'small', path: square(100, 100, 100) }
    expect(regionAt([150, 150], [big, small])?.id).toBe('small')
    expect(regionAt([350, 350], [big, small])?.id).toBe('big')
    expect(regionAt([900, 900], [big, small])).toBeNull()
  })
})
