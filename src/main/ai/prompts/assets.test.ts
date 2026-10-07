import { describe, expect, it } from 'vitest'
import type { PictureHabits } from '@shared/assets/types'
import { fixtureStyle } from '@shared/deck/testing'
import { fakeAsset } from '../../services/assets/testing'
import { buildSystem } from './context'
import {
  MAX_CATALOGUE_LINES,
  buildAssetCatalogue,
  factOf,
  habitsOf,
  placementLines
} from './assets'

const logo = fakeAsset('school_logo', {
  kind: 'logo',
  title: 'School logo',
  description: 'Navy crest with a gold star.\nUsed top-right.',
  tags: ['school', 'crest'],
  usedIn: ['a', 'b', 'c']
})
const leaf = fakeAsset('leaf_photo', {
  kind: 'photo',
  title: 'Leaf photo',
  description: 'x'.repeat(300),
  usedIn: ['a']
})
const card = fakeAsset('happy_card', { kind: 'symbol-card', title: 'Happy card' })

const habits: PictureHabits = {
  lines: ['Content slides carry one picture on the right, about a third of the slide.'],
  slideKinds: [
    { kind: 'content', pictures: 'usually', typicalBox: null },
    { kind: 'objectives', pictures: 'never', typicalBox: null }
  ],
  placements: [
    {
      assetId: logo.id,
      slideKind: 'every',
      anchor: 'top-right',
      widthUnits: 240,
      marginUnits: 48,
      decks: 6
    },
    {
      assetId: card.id,
      slideKind: 'title',
      anchor: 'bottom',
      widthUnits: 300,
      marginUnits: 32,
      decks: 3
    },
    {
      assetId: 'ast_deleted',
      slideKind: 'every',
      anchor: 'left',
      widthUnits: 100,
      marginUnits: 10,
      decks: 2
    }
  ]
}

describe('buildAssetCatalogue', () => {
  it('lists placement rules, then one line per asset, most used first, descriptions cut', () => {
    const { text } = buildAssetCatalogue([card, leaf, logo], habits)
    const lines = text.split('\n')
    expect(lines[0]).toContain("The teacher's assets")
    expect(text).toContain(
      '- school_logo: every slide, top-right, 240 units wide, 48 from the edge'
    )
    expect(text).toContain('- happy_card: title slides, bottom, 300 units wide, 32 from the edge')
    expect(text).toContain('- Picture use: content slides usually, objectives slides never')
    expect(text).toContain('- Content slides carry one picture on the right')
    // A rule for an asset that is gone is not shown.
    expect(text).not.toContain('ast_deleted')
    const library = lines.slice(lines.findIndex((l) => l.startsWith('Library (3)')) + 1)
    expect(library.map((l) => l.split(' · ')[0])).toEqual([
      '- school_logo',
      '- leaf_photo',
      '- happy_card'
    ])
    expect(library[0]).toBe(
      '- school_logo · logo · School logo · Navy crest with a gold star. Used top-right. · school, crest'
    )
    expect(library[1].split(' · ')[3]).toHaveLength(120)
    expect(library[1]).toContain('…')
  })

  it('is deterministic and says nothing for an empty library', () => {
    expect(buildAssetCatalogue([logo, leaf], habits).text).toBe(
      buildAssetCatalogue([leaf, logo], habits).text
    )
    expect(buildAssetCatalogue([], habits).text).toBe('')
  })

  it('shows 60 lines at most but resolves every name, and points at list_assets in chat', () => {
    const many = Array.from({ length: 75 }, (_, i) =>
      fakeAsset(`picture_${String(i).padStart(2, '0')}`)
    )
    const generation = buildAssetCatalogue(many)
    expect(generation.text.split('\n').filter((l) => l.startsWith('- picture_'))).toHaveLength(
      MAX_CATALOGUE_LINES
    )
    expect(generation.text).toContain('(15 more are not shown.)')
    expect(generation.find('PICTURE_74')).toMatchObject({ name: 'picture_74' })
    expect(buildAssetCatalogue(many, undefined, { canSearch: true }).text).toContain(
      '(15 more: call list_assets with a query to find them.)'
    )
  })

  it('finds assets by name in any case and with braces, and gives facts without usage data', () => {
    const { find } = buildAssetCatalogue([logo])
    expect(find(' {{School_Logo}} ')).toEqual(factOf(logo))
    expect(find('nope')).toBeUndefined()
    expect(Object.keys(factOf(logo)).sort()).toEqual(
      ['description', 'height', 'id', 'kind', 'name', 'tags', 'title', 'vector', 'width'].sort()
    )
  })
})

describe('habits and the system prompt', () => {
  it('reads the picture habits off a style profile when it has them', () => {
    const style = fixtureStyle()
    expect(habitsOf(style)).toBeUndefined()
    expect(habitsOf(null)).toBeUndefined()
    expect(habitsOf({ ...style, pictures: habits } as never)).toBe(habits)
    expect(placementLines(undefined, new Map())).toEqual([])
  })

  it('gives the assets their own cached part after the profile, and leaves it out when empty', () => {
    const style = fixtureStyle()
    const withAssets = buildSystem({
      instructions: ['x'],
      profile: style,
      assets: buildAssetCatalogue([logo]).text
    })
    expect(withAssets).toHaveLength(3)
    expect(withAssets[2]).toMatchObject({ cache: true })
    expect(withAssets[2].text).toContain('school_logo')
    expect(buildSystem({ instructions: ['x'], profile: style, assets: '' })).toHaveLength(2)
  })
})
