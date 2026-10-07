import { describe, expect, it } from 'vitest'
import { style } from '../fixtures'
import { defaultStyleId, filterStyles, orderStyles } from './styles'

const SCIENCE = style()
const FORM = style({
  id: 's2',
  name: 'Form time',
  isDefault: false,
  updatedAt: '2026-10-03T00:00:00Z'
})
const OLDER = style({
  id: 's3',
  name: 'Maths',
  isDefault: false,
  updatedAt: '2026-08-01T00:00:00Z'
})

describe('filterStyles', () => {
  it('keeps all styles for an empty query and matches names case-insensitively', () => {
    expect(filterStyles([SCIENCE, FORM], '')).toHaveLength(2)
    expect(filterStyles([SCIENCE, FORM], 'FORM').map((s) => s.id)).toEqual(['s2'])
    expect(filterStyles([SCIENCE, FORM], 'zzz')).toEqual([])
  })
})

describe('defaultStyleId', () => {
  it('prefers the default style, then the first, then null', () => {
    expect(defaultStyleId([FORM, SCIENCE])).toBe('s1')
    expect(defaultStyleId([FORM, OLDER])).toBe('s2')
    expect(defaultStyleId([])).toBeNull()
  })
})

describe('orderStyles', () => {
  it('puts the default first, then the most recently updated', () => {
    expect(orderStyles([OLDER, FORM, SCIENCE]).map((s) => s.id)).toEqual(['s1', 's2', 's3'])
  })
})
