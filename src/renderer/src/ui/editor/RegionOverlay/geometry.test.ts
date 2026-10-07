import { describe, expect, it } from 'vitest'
import {
  boundsOf,
  clientToSlide,
  dimOutsideData,
  labelPlacement,
  movePoint,
  pathData
} from './geometry'

const box = { left: 100, top: 50, width: 960, height: 540 }

describe('clientToSlide', () => {
  it('maps the box corners to the slide corners whatever its displayed size', () => {
    expect(clientToSlide(100, 50, box)).toEqual([0, 0])
    expect(clientToSlide(1060, 590, box)).toEqual([1920, 1080])
    expect(clientToSlide(580, 320, box)).toEqual([960, 540])
    const small = { left: 0, top: 0, width: 480, height: 270 }
    expect(clientToSlide(240, 135, small)).toEqual([960, 540])
  })

  it('uses the scale for the size and the box only for the origin', () => {
    expect(clientToSlide(300, 150, box, 0.5)).toEqual([400, 200])
    expect(clientToSlide(300, 150, { ...box, width: 0, height: 0 }, 0.5)).toEqual([400, 200])
  })

  it('clamps to the slide', () => {
    expect(clientToSlide(0, 0, box)).toEqual([0, 0])
    expect(clientToSlide(5000, 5000, box)).toEqual([1920, 1080])
    expect(clientToSlide(5000, -5000, box, 1)).toEqual([1920, 0])
  })

  it('returns the origin for an unmeasured box without a scale', () => {
    expect(clientToSlide(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual([0, 0])
  })
})

describe('pathData', () => {
  it('draws M then L segments, rounded to a tenth', () => {
    expect(
      pathData([
        [10, 20.04],
        [30.26, 40]
      ])
    ).toBe('M10 20 L30.3 40')
  })

  it('closes on request and is empty for no points', () => {
    expect(
      pathData(
        [
          [0, 0],
          [10, 0],
          [10, 10]
        ],
        true
      )
    ).toBe('M0 0 L10 0 L10 10 Z')
    expect(pathData([])).toBe('')
  })
})

describe('dimOutsideData', () => {
  it('adds the region as a hole in a full-slide rectangle', () => {
    const d = dimOutsideData([
      [100, 100],
      [200, 100],
      [200, 200]
    ])
    expect(d.startsWith('M0 0 H1920 V1080 H0 Z')).toBe(true)
    expect(d.endsWith('M100 100 L200 100 L200 200 Z')).toBe(true)
  })

  it('dims the whole slide for a degenerate path', () => {
    expect(dimOutsideData([[1, 1]])).toBe('M0 0 H1920 V1080 H0 Z')
  })
})

describe('boundsOf', () => {
  it('is the box around the points', () => {
    expect(
      boundsOf([
        [10, 40],
        [50, 20],
        [30, 90]
      ])
    ).toEqual({ x: 10, y: 20, w: 40, h: 70 })
  })

  it('is null for no points', () => {
    expect(boundsOf([])).toBeNull()
  })
})

describe('labelPlacement', () => {
  it('sits 2% of the stage width left of the box and level with its top', () => {
    const placed = labelPlacement({ x: 960, y: 540, w: 100, h: 100 })
    expect(placed.left).toBeCloseTo(48, 5)
    expect(placed.top).toBeCloseTo(50, 5)
  })

  it('stays inside the stage', () => {
    expect(labelPlacement({ x: 0, y: 0, w: 10, h: 10 })).toEqual({ left: 0, top: 0 })
    expect(labelPlacement({ x: 1900, y: 1080, w: 10, h: 10 }).left).toBe(76)
  })
})

describe('movePoint', () => {
  it('steps and clamps to the slide', () => {
    expect(movePoint([100, 100], 40, -40)).toEqual([140, 60])
    expect(movePoint([10, 10], -40, -40)).toEqual([0, 0])
    expect(movePoint([1900, 1070], 40, 40)).toEqual([1920, 1080])
  })
})
