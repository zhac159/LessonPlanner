import { describe, expect, it, vi } from 'vitest'
import { domFitMeasurer, factorAt, findFitFactor, FIT_STEP, MIN_FIT } from './fit'

describe('factorAt', () => {
  it('steps down 2% at a time to exactly 60%', () => {
    expect(factorAt(0)).toBe(1)
    expect(factorAt(1)).toBe(0.98)
    expect(factorAt(7)).toBe(0.86)
    expect(factorAt(20)).toBe(MIN_FIT)
    expect(FIT_STEP).toBe(0.02)
  })
})

describe('findFitFactor', () => {
  it('returns full size without shrinking when it already fits (one measurement)', () => {
    const fits = vi.fn(() => true)
    expect(findFitFactor(fits, true)).toEqual({ factor: 1, overflow: false })
    expect(fits).toHaveBeenCalledTimes(1)
  })

  it('finds the largest factor that fits, in 2% steps', () => {
    for (const limit of [0.98, 0.9, 0.84, 0.72, 0.62, 0.6]) {
      const result = findFitFactor((f) => f <= limit, true)
      expect(result).toEqual({ factor: limit, overflow: false })
    }
  })

  it('rounds the limit down to the next 2% step', () => {
    expect(findFitFactor((f) => f <= 0.855, true).factor).toBe(0.84)
  })

  it('stops at 60% and reports overflow when nothing fits', () => {
    expect(findFitFactor(() => false, true)).toEqual({ factor: MIN_FIT, overflow: true })
  })

  it('does not shrink when shrinking is off, but still reports overflow', () => {
    const fits = vi.fn((f: number) => f <= 0.8)
    expect(findFitFactor(fits, false)).toEqual({ factor: 1, overflow: true })
    expect(fits).toHaveBeenCalledTimes(1)
    expect(findFitFactor(() => true, false)).toEqual({ factor: 1, overflow: false })
  })

  it('needs only a handful of measurements', () => {
    const fits = vi.fn((f: number) => f <= 0.7)
    findFitFactor(fits, true)
    expect(fits.mock.calls.length).toBeLessThanOrEqual(8)
  })
})

describe('domFitMeasurer', () => {
  const box = (sh: number, ch: number, sw = 100, cw = 100) => ({
    scrollHeight: sh,
    clientHeight: ch,
    scrollWidth: sw,
    clientWidth: cw
  })

  it('fits when nothing overflows, with 1px tolerance', () => {
    expect(domFitMeasurer(box(100, 100), 1)).toBe(true)
    expect(domFitMeasurer(box(101, 100), 1)).toBe(true)
  })

  it('does not fit when content is taller or wider than the box', () => {
    expect(domFitMeasurer(box(102, 100), 1)).toBe(false)
    expect(domFitMeasurer(box(100, 100, 150, 100), 1)).toBe(false)
  })
})
