import { describe, expect, it } from 'vitest'
import { LICENCES } from '@shared/assets/credits'
import type { Asset } from '@shared/assets/types'
import {
  buildFroms,
  chipOf,
  cleanTitle,
  detailOf,
  matchesFrom,
  normaliseTags,
  queryLibrary,
  removedChip,
  summaryOf
} from './library'
import { fakeAsset } from './testing'

/** The twelve assets of the A1 mock-up, oldest first, with the usage counts it shows. */
const A1: Array<[string, Partial<Asset>]> = [
  ['school_logo', { kind: 'logo', usedIn: Array(14).fill('l'), tags: ['logo', 'title slides'] }],
  ['do_now_banner', { kind: 'banner', usedIn: Array(18).fill('l') }],
  ['owl_mascot', { kind: 'character', usedIn: Array(9).fill('l') }],
  ['beaker_icon', { kind: 'icon', usedIn: Array(11).fill('l') }],
  ['microscope_icon', { kind: 'icon', usedIn: Array(6).fill('l') }],
  ['leaf_icon', { kind: 'icon', usedIn: Array(7).fill('l') }],
  ['timer_icon', { kind: 'icon', usedIn: Array(12).fill('l') }],
  ['lightbulb_icon', { kind: 'icon', usedIn: Array(5).fill('l') }],
  ['mini_whiteboard_icon', { kind: 'icon', usedIn: Array(16).fill('l') }],
  ['plant_cell_diagram', { kind: 'diagram', usedIn: Array(3).fill('l') }],
  ['leaf_cross_section', { kind: 'diagram', usedIn: Array(2).fill('l') }],
  ['forest_photo', { kind: 'photo', usedIn: ['l'] }]
]

const library = (): Asset[] =>
  A1.map(([name, over], at) =>
    fakeAsset(name, {
      ...over,
      createdAt: `2026-10-07T09:${String(at).padStart(2, '0')}:00.000Z`,
      source: { kind: 'extracted', styleId: 'sty_science', fileName: 'Y8.pptx', page: 1, at: 'x' }
    })
  )

const NAMES = new Map([['sty_science', 'Science KS3']])

describe('cleaning text', () => {
  it('keeps at most 12 lower-case tags of at most 24 characters, without repeats', () => {
    expect(normaliseTags([' Logo ', 'logo', '', 'Title Slides'])).toEqual(['logo', 'title slides'])
    expect(normaliseTags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(12)
    expect(normaliseTags(['x'.repeat(30)])[0]).toHaveLength(24)
  })

  it('makes a title from the name when none is given and cuts long ones', () => {
    expect(cleanTitle('  ', 'owl_mascot')).toBe('Owl mascot')
    expect(cleanTitle('x'.repeat(80), 'a')).toHaveLength(60)
  })
})

describe('what the screens show', () => {
  it('builds the card, the detail and the chips', () => {
    const asset = fakeAsset('school_logo', {
      kind: 'logo',
      usedIn: ['a', 'b'],
      foundIn: [{ styleId: 's', sourceId: 'x', fileName: 'Y8.pptx', page: 1 }],
      licence: LICENCES['cc-by'],
      description: 'Navy shield.'
    })
    expect(summaryOf(asset, 'data:x')).toMatchObject({
      name: 'school_logo',
      thumbDataUrl: 'data:x',
      usedInCount: 2,
      foundInCount: 1,
      licenceBadge: 'CC BY',
      sourceKind: 'uploaded'
    })
    expect(detailOf(asset, null, 'data:p')).toMatchObject({
      description: 'Navy shield.',
      previewDataUrl: 'data:p',
      bytes: 1000
    })
    expect(summaryOf(fakeAsset('mine'), null).licenceBadge).toBeNull()
    expect(chipOf(asset, null)).toMatchObject({ name: 'school_logo', removed: false, kind: 'logo' })
    expect(removedChip('ast_x', 'old_name')).toEqual({
      assetId: 'ast_x',
      name: 'old_name',
      kind: null,
      thumbDataUrl: null,
      removed: true
    })
  })
})

describe('queryLibrary', () => {
  it('lists the newest first, 60 at a time, and counts per pill', () => {
    const result = queryLibrary(library(), undefined, NAMES)
    expect(result.page[0]?.name).toBe('forest_photo')
    expect(result.total).toBe(12)
    expect(result.counts).toMatchObject({
      all: 12,
      logos: 1,
      icons: 6,
      pictures: 1,
      diagrams: 2,
      banners: 1,
      characters: 1,
      'symbol-cards': 0
    })
    expect(result.cursor).toBeNull()
  })

  it('searches word starts ("beak" finds beaker_icon) and keeps the pill counts steady', () => {
    const result = queryLibrary(library(), { search: 'beak' }, NAMES)
    expect(result.page.map((a) => a.name)).toEqual(['beaker_icon'])
    expect(result.counts.all).toBe(12)
  })

  it('filters by pill, combines with the search, and ignores an unknown pill', () => {
    expect(queryLibrary(library(), { filter: 'diagrams' }, NAMES).total).toBe(2)
    expect(queryLibrary(library(), { filter: 'icons', search: 'leaf' }, NAMES).page).toHaveLength(1)
    expect(queryLibrary(library(), { filter: 'nope' as never }, NAMES).total).toBe(12)
  })

  it('sorts by name and by most used', () => {
    const byName = queryLibrary(library(), { sort: 'name' }, NAMES).page.map((a) => a.title)
    expect(byName[0]).toBe('beaker icon')
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)))
    expect(
      queryLibrary(library(), { sort: 'most-used', limit: 2 }, NAMES).page.map((a) => a.name)
    ).toEqual(['do_now_banner', 'mini_whiteboard_icon'])
  })

  it('pages with a cursor', () => {
    const first = queryLibrary(library(), { limit: 5 }, NAMES)
    expect(first.page).toHaveLength(5)
    expect(first.cursor).toBe('5')
    const last = queryLibrary(library(), { limit: 5, cursor: '10' }, NAMES)
    expect(last.page).toHaveLength(2)
    expect(last.cursor).toBeNull()
    expect(queryLibrary(library(), { limit: 5000 }, NAMES).page).toHaveLength(12)
  })
})

describe('the From select', () => {
  const mixed = (): Asset[] => [
    ...library(),
    fakeAsset('own_photo', { source: { kind: 'uploaded', fileName: 'a.png', at: 'x' } }),
    fakeAsset('cut_out', {
      source: { kind: 'extracted', styleId: null, fileName: 'b.pptx', page: 2, at: 'x' }
    }),
    fakeAsset('wiki_leaf', { source: { kind: 'online', provider: 'wikimedia', at: 'x' } }),
    fakeAsset('made_owl', {
      source: { kind: 'generated', model: 'm', prompt: 'p', basedOn: [], at: 'x' }
    })
  ]

  it('offers Anywhere, each style that found pictures, and only the sources she has', () => {
    expect(buildFroms(mixed(), NAMES)).toEqual([
      { key: 'anywhere', label: 'Anywhere', count: 16 },
      { key: 'style:sty_science', label: 'Science KS3 style', count: 12 },
      { key: 'uploaded', label: 'Uploaded by me', count: 2 },
      { key: 'online', label: 'Picked online', count: 1 },
      { key: 'made', label: 'Made with Claude', count: 1 }
    ])
    expect(buildFroms(library(), NAMES).map((f) => f.key)).toEqual([
      'anywhere',
      'style:sty_science'
    ])
  })

  it('filters by source and counts the pills inside it', () => {
    expect(queryLibrary(mixed(), { from: 'online' }, NAMES).page.map((a) => a.name)).toEqual([
      'wiki_leaf'
    ])
    expect(queryLibrary(mixed(), { from: 'style:sty_science' }, NAMES).counts.all).toBe(12)
    expect(matchesFrom(mixed()[12]!, 'uploaded')).toBe(true)
    expect(matchesFrom(mixed()[0]!, 'made')).toBe(false)
  })

  it('counts a picture as found by a style when a deck of that style shows it', () => {
    const seen = fakeAsset('x', {
      source: { kind: 'uploaded', fileName: 'a', at: 'x' },
      foundIn: [{ styleId: 'sty_form', sourceId: 's', fileName: 'f.pptx', page: 1 }]
    })
    expect(matchesFrom(seen, 'style:sty_form')).toBe(true)
    expect(buildFroms([seen], new Map()).map((f) => f.label)).toEqual([
      'Anywhere',
      'Your style',
      'Uploaded by me'
    ])
  })
})
