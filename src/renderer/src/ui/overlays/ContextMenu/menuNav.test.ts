import { describe, expect, it } from 'vitest'
import { firstEnabled, lastEnabled, matchTypeahead, nextEnabled } from './menuNav'

const items = [
  { label: 'Open' },
  { label: 'Duplicate', disabled: true },
  { label: 'Export to PowerPoint' },
  { label: 'Delete…' }
]

describe('nextEnabled', () => {
  it('moves forward and back, skipping disabled items', () => {
    expect(nextEnabled(items, 0, 1)).toBe(2)
    expect(nextEnabled(items, 2, -1)).toBe(0)
  })
  it('wraps around both ends', () => {
    expect(nextEnabled(items, 3, 1)).toBe(0)
    expect(nextEnabled(items, 0, -1)).toBe(3)
  })
  it('returns -1 when nothing is enabled and stays put with one enabled item', () => {
    expect(nextEnabled([{ label: 'a', disabled: true }], 0, 1)).toBe(-1)
    expect(nextEnabled([{ label: 'a' }], 0, 1)).toBe(0)
    expect(nextEnabled([], 0, 1)).toBe(-1)
  })
})

describe('firstEnabled / lastEnabled', () => {
  it('finds the ends of the enabled range', () => {
    const list = [
      { label: 'a', disabled: true },
      { label: 'b' },
      { label: 'c' },
      { label: 'd', disabled: true }
    ]
    expect(firstEnabled(list)).toBe(1)
    expect(lastEnabled(list)).toBe(2)
    expect(firstEnabled([])).toBe(-1)
    expect(lastEnabled([{ label: 'x', disabled: true }])).toBe(-1)
  })
})

describe('matchTypeahead', () => {
  it('finds the next item starting with the letter, case-insensitively', () => {
    expect(matchTypeahead(items, 0, 'e')).toBe(2)
    expect(matchTypeahead(items, 0, 'D')).toBe(3)
  })
  it('skips disabled matches', () => {
    expect(matchTypeahead(items, 3, 'd')).toBe(3)
  })
  it('cycles through items sharing a first letter when the letter repeats', () => {
    const list = [{ label: 'Share' }, { label: 'Save' }, { label: 'Send' }]
    expect(matchTypeahead(list, 0, 's')).toBe(1)
    expect(matchTypeahead(list, 1, 'ss')).toBe(2)
  })
  it('matches multi-letter prefixes from the current item', () => {
    const list = [{ label: 'Save' }, { label: 'Send' }, { label: 'Settings' }]
    expect(matchTypeahead(list, 0, 'se')).toBe(1)
    expect(matchTypeahead(list, 0, 'set')).toBe(2)
  })
  it('returns -1 for no match or empty query', () => {
    expect(matchTypeahead(items, 0, 'z')).toBe(-1)
    expect(matchTypeahead(items, 0, '')).toBe(-1)
  })
})
