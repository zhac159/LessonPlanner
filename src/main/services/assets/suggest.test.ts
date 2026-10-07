import { describe, expect, it } from 'vitest'
import { fakeAsset } from './testing'
import { rankAssets, scoreAsset, stem, wordsOf } from './suggest'

const LIBRARY = [
  fakeAsset('school_logo', { kind: 'logo', description: 'Navy shield with a gold chevron.' }),
  fakeAsset('owl_mascot', { kind: 'character', tags: ['owl', 'mascot'] }),
  fakeAsset('leaf_icon', { kind: 'icon', tags: ['plants'] }),
  fakeAsset('leaf_cross_section', {
    kind: 'diagram',
    title: 'Leaf cross-section',
    tags: ['leaf', 'layers'],
    description: 'Labelled diagram of the layers of a leaf.'
  }),
  fakeAsset('plant_cell_diagram', {
    kind: 'diagram',
    title: 'Plant cell',
    description: 'Plant cell with chloroplasts and a nucleus.'
  }),
  fakeAsset('beaker_icon', { kind: 'icon', tags: ['lab'] })
]

describe('words', () => {
  it('drops filler and plural endings', () => {
    expect(wordsOf('The leaves of the plants, in the Do Now!')).toEqual(['leaf', 'plant'])
    expect(stem('cells')).toBe('cell')
    expect(stem('leaves')).toBe('leaf')
    expect(stem('boxes')).toBe('box')
    expect(stem('glass')).toBe('glass')
  })
})

describe('rankAssets (A11: a circle on a leaf slide)', () => {
  const slide = 'Photosynthesis: how a leaf makes food. Look at the plant cell.'

  it('puts leaf pictures first and leaves out what shares no word', () => {
    const ranked = rankAssets(LIBRARY, { text: slide, focus: 'leaf in sunlight' })
    expect(ranked.map((a) => a.name)).toEqual([
      'leaf_cross_section',
      'leaf_icon',
      'plant_cell_diagram'
    ])
  })

  it('counts the spot words double and a kind word as a hint', () => {
    const ranked = rankAssets(LIBRARY, { text: '', focus: 'school logo' })
    expect(ranked[0]?.name).toBe('school_logo')
    expect(rankAssets(LIBRARY, { text: '', focus: 'a diagram of a cell' })[0]?.name).toBe(
      'plant_cell_diagram'
    )
  })

  it('returns nothing for an empty or unrelated slide and respects the limit', () => {
    expect(rankAssets(LIBRARY, { text: '', focus: '' })).toEqual([])
    expect(rankAssets(LIBRARY, { text: 'Volcano eruption', focus: '' })).toEqual([])
    expect(rankAssets(LIBRARY, { text: slide, focus: 'leaf' }, 1)).toHaveLength(1)
  })

  it('breaks ties by use, then by newest', () => {
    const a = fakeAsset('leaf_one', { usedIn: ['l'] })
    const b = fakeAsset('leaf_two', { usedIn: ['l', 'm'] })
    expect(rankAssets([a, b], { text: 'leaf', focus: '' }).map((x) => x.name)).toEqual([
      'leaf_two',
      'leaf_one'
    ])
    expect(scoreAsset(a, { text: 'leaf', focus: '' })).toBeGreaterThan(0)
  })
})
