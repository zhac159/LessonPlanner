import { describe, expect, it } from 'vitest'
import { lesson } from '../fixtures'
import {
  ALL_YEARS,
  effectiveYear,
  emptyKind,
  filterLessons,
  sortLessons,
  yearGroups
} from './lessons'

const titles = (list: ReadonlyArray<{ title: string }>): string[] => list.map((l) => l.title)

const LESSONS = [
  lesson({
    id: 'a',
    title: 'Photosynthesis',
    yearGroup: 'Year 8',
    updatedAt: '2026-10-06T08:00:00Z'
  }),
  lesson({
    id: 'b',
    title: 'Cells and organelles',
    yearGroup: 'Year 7',
    updatedAt: '2026-10-05T08:00:00Z'
  }),
  lesson({
    id: 'c',
    title: 'Staying safe online',
    yearGroup: 'Form time',
    yearShort: 'Form',
    updatedAt: '2026-09-20T08:00:00Z'
  }),
  lesson({ id: 'd', title: 'Forces', yearGroup: 'Year 10', updatedAt: '2026-10-01T08:00:00Z' }),
  lesson({ id: 'e', title: 'Acids', yearGroup: 'Year 8', updatedAt: '2026-10-02T08:00:00Z' }),
  lesson({
    id: 'f',
    title: 'Sixth form revision',
    yearGroup: 'Sixth form',
    updatedAt: '2026-09-01T08:00:00Z'
  }),
  lesson({
    id: 'g',
    title: 'Untagged',
    yearGroup: null,
    yearShort: null,
    updatedAt: '2026-08-01T08:00:00Z'
  })
]

describe('yearGroups', () => {
  it('orders Year 7…13, Form time, then others A–Z, without duplicates or blanks', () => {
    expect(yearGroups(LESSONS)).toEqual(['Year 7', 'Year 8', 'Year 10', 'Form time', 'Sixth form'])
  })

  it('sorts years numerically, not alphabetically', () => {
    const list = ['Year 10', 'Year 9', 'Year 13', 'Year 7'].map((yearGroup, i) =>
      lesson({ id: String(i), yearGroup })
    )
    expect(yearGroups(list)).toEqual(['Year 7', 'Year 9', 'Year 10', 'Year 13'])
  })

  it('is empty when no lesson has a year group', () => {
    expect(yearGroups([lesson({ yearGroup: null }), lesson({ id: 'x', yearGroup: '  ' })])).toEqual(
      []
    )
  })
})

describe('effectiveYear', () => {
  it('keeps a group that exists and falls back to All when it is gone', () => {
    expect(effectiveYear('Year 8', ['Year 7', 'Year 8'])).toBe('Year 8')
    expect(effectiveYear('Year 9', ['Year 7', 'Year 8'])).toBe(ALL_YEARS)
    expect(effectiveYear(ALL_YEARS, [])).toBe(ALL_YEARS)
  })
})

describe('filterLessons', () => {
  it('returns everything for All and an empty query', () => {
    expect(filterLessons(LESSONS, { query: '', year: ALL_YEARS })).toHaveLength(LESSONS.length)
  })

  it('filters by year group', () => {
    expect(titles(filterLessons(LESSONS, { query: '', year: 'Year 8' }))).toEqual([
      'Photosynthesis',
      'Acids'
    ])
  })

  it('matches the title case- and accent-insensitively', () => {
    expect(titles(filterLessons(LESSONS, { query: 'PHOTO', year: ALL_YEARS }))).toEqual([
      'Photosynthesis'
    ])
    const accented = [lesson({ title: 'Café society' })]
    expect(filterLessons(accented, { query: 'cafe', year: ALL_YEARS })).toHaveLength(1)
  })

  it('matches the year group text', () => {
    expect(titles(filterLessons(LESSONS, { query: 'form time', year: ALL_YEARS }))).toEqual([
      'Staying safe online'
    ])
  })

  it('stacks search with the year filter', () => {
    expect(filterLessons(LESSONS, { query: 'acids', year: 'Year 7' })).toEqual([])
    expect(titles(filterLessons(LESSONS, { query: 'acids', year: 'Year 8' }))).toEqual(['Acids'])
  })
})

describe('sortLessons', () => {
  it('Last edited puts the newest first', () => {
    expect(sortLessons(LESSONS, 'edited').map((l) => l.id)).toEqual([
      'a',
      'b',
      'e',
      'd',
      'c',
      'f',
      'g'
    ])
  })

  it('Last edited leads with a lesson that is still generating', () => {
    const generating = lesson({
      id: 'gen',
      title: 'New',
      status: 'generating',
      updatedAt: '2026-01-01T00:00:00Z'
    })
    expect(sortLessons([...LESSONS, generating], 'edited')[0].id).toBe('gen')
  })

  it('Title A–Z compares numerically in en-GB', () => {
    const list = ['Lesson 10', 'Lesson 2', 'apples', 'Zebra'].map((title, i) =>
      lesson({ id: String(i), title })
    )
    expect(titles(sortLessons(list, 'title'))).toEqual(['apples', 'Lesson 2', 'Lesson 10', 'Zebra'])
  })

  it('Year group orders Year 7…, Form time, others, then no year, newest first inside a year', () => {
    expect(sortLessons(LESSONS, 'year').map((l) => l.id)).toEqual([
      'b',
      'a',
      'e',
      'd',
      'c',
      'f',
      'g'
    ])
  })

  it('does not change the input array', () => {
    const copy = [...LESSONS]
    sortLessons(LESSONS, 'title')
    expect(LESSONS).toEqual(copy)
  })
})

describe('emptyKind', () => {
  it('says none when something is shown', () => {
    expect(emptyKind({ total: 3, shown: 1, query: '', year: ALL_YEARS })).toEqual({ kind: 'none' })
  })

  it('says no lessons when nothing is saved, even with a query', () => {
    expect(emptyKind({ total: 0, shown: 0, query: 'x', year: ALL_YEARS })).toEqual({
      kind: 'no-lessons'
    })
  })

  it('says no match for a search and no year for a filter', () => {
    expect(emptyKind({ total: 3, shown: 0, query: ' photo ', year: ALL_YEARS })).toEqual({
      kind: 'no-match',
      query: 'photo'
    })
    expect(emptyKind({ total: 3, shown: 0, query: '', year: 'Year 9' })).toEqual({
      kind: 'no-year',
      year: 'Year 9'
    })
  })
})
