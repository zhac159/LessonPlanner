import { describe, expect, it } from 'vitest'
import { assertRenderWidth, planCrop, planSlide, planView } from './plan'

describe('assertRenderWidth', () => {
  it('accepts whole widths from 16 to 4096', () => {
    expect(assertRenderWidth(16)).toBe(16)
    expect(assertRenderWidth(1280)).toBe(1280)
    expect(assertRenderWidth(4096)).toBe(4096)
  })

  it.each([0, 15, 4097, 100.5, Number.NaN, Number.POSITIVE_INFINITY, -1280])(
    'rejects %s',
    (width) => {
      expect(() => assertRenderWidth(width)).toThrow(RangeError)
    }
  )
})

describe('planSlide', () => {
  it('is the whole slide at 1280 wide by default', () => {
    const plan = planSlide()
    expect(plan.viewport).toEqual({ x: 0, y: 0, w: 1920, h: 1080 })
    expect(plan.scale).toBeCloseTo(2 / 3)
  })

  it('scales to the requested width', () => {
    expect(planSlide(480).scale).toBeCloseTo(0.25)
    expect(planSlide(1920).scale).toBe(1)
  })

  it('rejects an unusable width', () => {
    expect(() => planSlide(5)).toThrow(/width/)
  })
})

describe('planCrop', () => {
  it('is the padded box at twice the density of a 1280 slide', () => {
    const plan = planCrop({ x: 1000, y: 300, w: 500, h: 400 })
    expect(plan.viewport).toEqual({ x: 950, y: 260, w: 600, h: 480 })
    expect(plan.scale).toBeCloseTo(4 / 3)
  })

  it('follows the reference width', () => {
    expect(planCrop({ x: 100, y: 100, w: 200, h: 200 }, 960).scale).toBeCloseTo(1)
  })

  it('caps the density so a full-slide crop stays within the size limit', () => {
    const plan = planCrop({ x: 0, y: 0, w: 1920, h: 1080 }, 4096)
    expect(plan.viewport).toEqual({ x: 0, y: 0, w: 1920, h: 1080 })
    expect(plan.viewport.w * plan.scale).toBeLessThanOrEqual(4096)
    expect(plan.scale).toBeLessThanOrEqual(4)
  })

  it('is clamped to the slide for a loop in the corner', () => {
    const { viewport } = planCrop({ x: 1700, y: 900, w: 220, h: 180 })
    expect(viewport.x + viewport.w).toBeLessThanOrEqual(1920)
    expect(viewport.y + viewport.h).toBeLessThanOrEqual(1080)
  })

  it('rejects an unusable width', () => {
    expect(() => planCrop({ x: 0, y: 0, w: 10, h: 10 }, 1.5)).toThrow(/width/)
  })
})

describe('planView', () => {
  it('scales a part of the slide to the width', () => {
    const plan = planView({ x: 100, y: 200, w: 960, h: 540 }, 480)
    expect(plan.viewport).toEqual({ x: 100, y: 200, w: 960, h: 540 })
    expect(plan.scale).toBeCloseTo(0.5)
  })

  it('fits inside width and height, keeping proportions', () => {
    expect(planView({ x: 0, y: 0, w: 1920, h: 1080 }, 960, 270).scale).toBeCloseTo(0.25)
    expect(planView({ x: 0, y: 0, w: 1920, h: 1080 }, 480, 540).scale).toBeCloseTo(0.25)
  })

  it('cuts a part that sticks out of the slide down to the slide', () => {
    const plan = planView({ x: -100, y: 900, w: 500, h: 500 }, 400)
    expect(plan.viewport).toEqual({ x: 0, y: 900, w: 400, h: 180 })
  })

  it('rejects an empty part, a part off the slide, and sizes the renderer cannot make', () => {
    expect(() => planView({ x: 0, y: 0, w: 0, h: 100 }, 400)).toThrow(RangeError)
    expect(() => planView({ x: 3000, y: 0, w: 100, h: 100 }, 400)).toThrow(/empty/)
    expect(() => planView({ x: 0, y: 0, w: 1920, h: 1080 }, 5)).toThrow(/width/)
    expect(() => planView({ x: 0, y: 0, w: 1920, h: 1080 }, 480, 3)).toThrow(/height/)
    expect(() => planView({ x: 0, y: 0, w: 20, h: 20 }, 4096)).toThrow(/scale/)
  })
})
