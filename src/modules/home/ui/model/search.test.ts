import { describe, expect, it } from 'vitest'
import { matchesQuery, normalise } from './search'

describe('normalise', () => {
  it('lower-cases, strips accents and collapses spaces', () => {
    expect(normalise('  Crème   BRÛLÉE ')).toBe('creme brulee')
  })
})

describe('matchesQuery', () => {
  it('matches everything for an empty or blank query', () => {
    expect(matchesQuery('', ['x'])).toBe(true)
    expect(matchesQuery('   ', [])).toBe(true)
  })

  it('matches a substring of any field, ignoring null fields', () => {
    expect(matchesQuery('photo', [null, 'Year 8', 'Photosynthesis'])).toBe(true)
    expect(matchesQuery('photo', [undefined, 'Cells'])).toBe(false)
  })

  it('ignores case and accents on both sides', () => {
    expect(matchesQuery('ÉCOLE', ['ecole primaire'])).toBe(true)
    expect(matchesQuery('cafe', ['Café'])).toBe(true)
  })
})
