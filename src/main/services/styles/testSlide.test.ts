import { describe, expect, it } from 'vitest'
import type { Element, Slide } from '@shared/deck/types'
import { createDraftProfile } from '@shared/style/draft'
import { makeAnalysis } from '@shared/style/testing'
import { checkTestSlide, isForeign, slideText } from './testSlide'

const text = (id: string, value: string): Element => ({
  id,
  type: 'text',
  role: 'heading',
  x: 0,
  y: 0,
  w: 500,
  h: 80,
  paragraphs: [{ runs: [{ text: value }] }]
})

const slide = (...elements: Element[]): Slide => ({
  id: 'sld_1',
  kind: 'key-words',
  layoutId: 'words',
  elements
})

const profile = () => {
  const p = createDraftProfile('sty_1', 'Stonebridge English', 'now')
  p.slideTypes = [
    { kind: 'objectives', name: 'Objectives', frequency: 'always', description: '' },
    { kind: 'question', name: 'Input', frequency: 'often', description: '' }
  ]
  p.layouts = [{ id: 'words', name: 'Words', usedFor: ['key-words'], regions: [], decorations: [] }]
  return p
}

const english = [makeAnalysis({ habits: ['Plural nouns with symbol cards'] })]

describe('checkTestSlide', () => {
  it('throws away the old fixed photosynthesis slide when her decks never mention it', () => {
    const foreign = slide(text('e1', 'Photosynthesis'), text('e2', 'Year 8 · Plants'))
    expect(isForeign(foreign, english, 'Stonebridge English')).toBe(true)
    expect(checkTestSlide(foreign, profile(), english)).toBeNull()
  })

  it('keeps a science slide for a science teacher whose analyses mention it', () => {
    const science = [makeAnalysis({ habits: ['Photosynthesis diagrams on content slides'] })]
    const ours = slide(text('e1', 'Photosynthesis'))
    expect(checkTestSlide(ours, profile(), science)).not.toBeNull()
  })

  it('removes a copied date, and drops an element that was only a date', () => {
    const kept = checkTestSlide(
      slide(
        text('e1', 'Plural nouns'),
        text('e2', 'Monday 5th October 2026'),
        text('e3', 'Input: Wednesday 7th October')
      ),
      profile(),
      english
    )!
    expect(kept.elements.map((e) => e.id)).toEqual(['e1', 'e3'])
    expect(slideText(kept)).toBe('Plural nouns Input:')
  })

  it('uses one of HER slide kinds and only layouts she has', () => {
    const wrongKind = checkTestSlide(
      { ...slide(text('e1', 'Words')), kind: 'plenary', layoutId: 'nope' },
      profile(),
      english
    )!
    expect(wrongKind.kind).toBe('objectives') // the first kind that is not a title: she has no key-words or content
    expect(wrongKind.layoutId).toBeUndefined()
    const withWords = profile()
    withWords.slideTypes.push({
      kind: 'key-words',
      name: 'Words',
      frequency: 'often',
      description: ''
    })
    const fine = checkTestSlide(slide(text('e1', 'Words')), withWords, english)!
    expect(fine).toMatchObject({ kind: 'key-words', layoutId: 'words' })
  })
})
