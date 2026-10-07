import { describe, expect, it } from 'vitest'
import { firstEnabled, lastEnabled, nextEnabled, typeaheadIndex } from './listNav'

describe('nextEnabled', () => {
  const disabled = [false, true, false, true]
  it('skips disabled items in both directions', () => {
    expect(nextEnabled(disabled, 0, 1)).toBe(2)
    expect(nextEnabled(disabled, 2, -1)).toBe(0)
  })
  it('returns -1 at the ends (no wrapping)', () => {
    expect(nextEnabled(disabled, 2, 1)).toBe(-1)
    expect(nextEnabled(disabled, 0, -1)).toBe(-1)
  })
  it('starts from nothing active', () => {
    expect(nextEnabled(disabled, -1, 1)).toBe(0)
  })
})

describe('firstEnabled / lastEnabled', () => {
  it('find the ends ignoring disabled items', () => {
    const disabled = [true, false, false, true]
    expect(firstEnabled(disabled)).toBe(1)
    expect(lastEnabled(disabled)).toBe(2)
  })
  it('return -1 when all are disabled', () => {
    expect(firstEnabled([true])).toBe(-1)
    expect(lastEnabled([true])).toBe(-1)
  })
})

describe('typeaheadIndex', () => {
  const labels = ['Science KS3', 'Maths', 'Music', 'English']
  const none = [false, false, false, false]

  it('finds the next item starting with the typed letter, after the current one', () => {
    expect(typeaheadIndex(labels, none, 'm', 0)).toBe(1)
    expect(typeaheadIndex(labels, none, 'm', 1)).toBe(2)
    expect(typeaheadIndex(labels, none, 'm', 2)).toBe(1)
  })
  it('matches a longer prefix, including on the current item', () => {
    expect(typeaheadIndex(labels, none, 'mu', 1)).toBe(2)
    expect(typeaheadIndex(labels, none, 'ma', 1)).toBe(1)
  })
  it('cycles on a repeated letter', () => {
    expect(typeaheadIndex(labels, none, 'mm', 1)).toBe(2)
  })
  it('is case-insensitive and skips disabled items', () => {
    expect(typeaheadIndex(labels, [false, true, false, false], 'MA', 0)).toBe(-1)
    expect(typeaheadIndex(labels, [false, true, false, false], 'M', 0)).toBe(2)
  })
  it('returns -1 for nothing typed or no match', () => {
    expect(typeaheadIndex(labels, none, '', 0)).toBe(-1)
    expect(typeaheadIndex(labels, none, 'z', 0)).toBe(-1)
  })
})
