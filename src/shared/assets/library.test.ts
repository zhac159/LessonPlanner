import { describe, expect, it } from 'vitest'
import {
  ASSET_FILTERS,
  filterCounts,
  lessonCountLabel,
  matchesAssetQuery,
  matchesFilter,
  recentlyUsed,
  visibleFilters
} from './library'
import type { Asset } from './types'

const a = (over: Partial<Asset>): Asset =>
  ({
    id: 'x',
    name: 'school_logo',
    title: 'School logo',
    kind: 'logo',
    description: 'School crest. Goes in the top-right corner of title slides.',
    tags: ['logo', 'title slides'],
    lastUsedAt: null,
    createdAt: '2026-10-01',
    ...over
  }) as Asset

describe('filters', () => {
  const assets = [
    a({ kind: 'logo' }),
    a({ kind: 'icon' }),
    a({ kind: 'icon' }),
    a({ kind: 'photo' }),
    a({ kind: 'picture' }),
    a({ kind: 'diagram' })
  ]
  it('counts by pill, with photos under Pictures', () => {
    const counts = filterCounts(assets)
    expect(counts).toMatchObject({
      all: 6,
      logos: 1,
      icons: 2,
      pictures: 2,
      diagrams: 1,
      banners: 0,
      'symbol-cards': 0
    })
    expect(matchesFilter(a({ kind: 'photo' }), 'pictures')).toBe(true)
    expect(matchesFilter(a({ kind: 'photo' }), 'icons')).toBe(false)
    expect(matchesFilter(a({ kind: 'photo' }), 'all')).toBe(true)
  })
  it('shows Symbol cards only once she has some', () => {
    expect(visibleFilters(filterCounts(assets)).map((f) => f.id)).not.toContain('symbol-cards')
    const withCards = filterCounts([...assets, a({ kind: 'symbol-card' })])
    expect(visibleFilters(withCards).map((f) => f.id)).toContain('symbol-cards')
    expect(ASSET_FILTERS[0]?.id).toBe('all')
  })
})

describe('matchesAssetQuery', () => {
  const logo = a({})
  const beaker = a({
    name: 'beaker_icon',
    title: 'Beaker',
    kind: 'icon',
    tags: ['science'],
    description: 'A glass beaker with teal liquid'
  })
  it('matches word prefixes in name, title, tags, kind and description', () => {
    expect(matchesAssetQuery(beaker, 'beak')).toBe(true)
    expect(matchesAssetQuery(beaker, 'teal liquid')).toBe(true)
    expect(matchesAssetQuery(beaker, 'icon')).toBe(true)
    expect(matchesAssetQuery(logo, 'title slides')).toBe(true)
    expect(matchesAssetQuery(logo, 'beak')).toBe(false)
    expect(matchesAssetQuery(logo, '   ')).toBe(true)
  })
})

describe('recentlyUsed and labels', () => {
  it('orders by last use and skips never-used assets', () => {
    const list = [
      a({ id: '1', lastUsedAt: '2026-10-03' }),
      a({ id: '2', lastUsedAt: null }),
      a({ id: '3', lastUsedAt: '2026-10-05' }),
      a({ id: '4', lastUsedAt: '2026-10-04' }),
      a({ id: '5', lastUsedAt: '2026-10-02' })
    ]
    expect(recentlyUsed(list).map((x) => x.id)).toEqual(['3', '4', '1'])
  })
  it('words lesson counts', () => {
    expect([0, 1, 14].map(lessonCountLabel)).toEqual(['Not used yet', '1 lesson', '14 lessons'])
  })
})
