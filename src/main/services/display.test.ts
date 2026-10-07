import { describe, expect, it } from 'vitest'
import { centeredBounds, parseDisplayOverride, pickDisplay, type DisplayLike } from './display'

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })
const display = (id: number, x: number, width = 1920, height = 1080): DisplayLike => ({
  id,
  bounds: rect(x, 0, width, height),
  workArea: rect(x, 0, width, height - 40)
})

describe('pickDisplay', () => {
  const two = [display(1, 0), display(2, 1920)]

  it('opens on the primary monitor by default, even with two monitors', () => {
    expect(pickDisplay(two, 1).id).toBe(1)
    expect(pickDisplay([display(2, -1920), display(1, 0)], 1).id).toBe(1)
    expect(pickDisplay([display(1, 0)], 1).id).toBe(1)
  })

  it('secondary mode uses the left-most non-primary monitor', () => {
    expect(pickDisplay(two, 1, { secondary: true }).id).toBe(2)
    expect(
      pickDisplay([display(1, 0), display(3, 3840), display(2, 1920)], 1, { secondary: true }).id
    ).toBe(2)
  })

  it('secondary mode falls back to the primary with one monitor', () => {
    expect(pickDisplay([display(1, 0)], 1, { secondary: true }).id).toBe(1)
  })

  it('honours a valid override index and ignores an invalid one', () => {
    expect(pickDisplay(two, 1, { index: 1 }).id).toBe(2)
    expect(pickDisplay(two, 2, { index: 9 }).id).toBe(2)
  })

  it('throws when there are no displays', () => {
    expect(() => pickDisplay([], 1)).toThrow()
  })
})

describe('centeredBounds', () => {
  it('centres the window in the work area', () => {
    expect(centeredBounds(rect(1920, 0, 1920, 1040), { width: 1280, height: 800 })).toEqual(
      rect(2240, 120, 1280, 800)
    )
  })

  it('shrinks to fit a small work area', () => {
    expect(centeredBounds(rect(0, 0, 1000, 700), { width: 1280, height: 800 })).toEqual(
      rect(0, 0, 1000, 700)
    )
  })
})

describe('parseDisplayOverride', () => {
  it('accepts whole numbers only', () => {
    expect(parseDisplayOverride('1')).toBe(1)
    expect(parseDisplayOverride(' 0 ')).toBe(0)
    expect(parseDisplayOverride('x')).toBeUndefined()
    expect(parseDisplayOverride(undefined)).toBeUndefined()
  })
})
