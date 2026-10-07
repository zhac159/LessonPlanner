import { describe, expect, it } from 'vitest'
import { clamp, parseNumber, stepBy } from './stepMath'

describe('clamp', () => {
  it('limits to both bounds', () => {
    expect(clamp(5, 3, 30)).toBe(5)
    expect(clamp(1, 3, 30)).toBe(3)
    expect(clamp(99, 3, 30)).toBe(30)
  })
  it('leaves missing bounds open', () => {
    expect(clamp(-100)).toBe(-100)
    expect(clamp(-100, 0)).toBe(0)
    expect(clamp(100, undefined, 10)).toBe(10)
  })
})

describe('stepBy', () => {
  it('adds the delta and clamps', () => {
    expect(stepBy(10, 1, 1, 3, 30)).toBe(11)
    expect(stepBy(29, 5, 1, 3, 30)).toBe(30)
    expect(stepBy(4, -5, 1, 3, 30)).toBe(3)
  })
  it('removes floating point noise', () => {
    expect(stepBy(0.1, 0.2, 0.1)).toBe(0.3)
    expect(stepBy(1.1, -0.1, 0.1)).toBe(1)
  })
})

describe('parseNumber', () => {
  it('parses numbers', () => {
    expect(parseNumber('12')).toBe(12)
    expect(parseNumber(' 7.5 ')).toBe(7.5)
    expect(parseNumber('-3')).toBe(-3)
  })
  it('returns null for empty or invalid text', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('  ')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('Infinity')).toBeNull()
  })
})
