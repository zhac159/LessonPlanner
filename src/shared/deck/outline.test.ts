import { describe, expect, it } from 'vitest'
import { deckOutline, outlineText } from './outline'
import { fixtureDeck, makeSlide, makeText } from './testing'
import { elementText, plainText, titleText } from './text'

describe('plainText / titleText / elementText', () => {
  const deck = fixtureDeck()

  it('joins runs and paragraphs', () => {
    expect(plainText([{ runs: [{ text: 'a' }, { text: 'b' }] }, { runs: [{ text: 'c' }] }])).toBe(
      'ab\nc'
    )
    expect(plainText([])).toBe('')
  })

  it('titleText returns the title on one line', () => {
    expect(titleText(deck.slides[0])).toBe('How do plants make food?')
    const multi = makeSlide('s', {
      elements: [
        makeText('t', '', {
          role: 'title',
          paragraphs: [{ runs: [{ text: 'One' }] }, { runs: [{ text: 'Two' }] }]
        })
      ]
    })
    expect(titleText(multi)).toBe('One Two')
  })

  it('titleText is empty when there is no title element', () => {
    expect(titleText(makeSlide('s', { elements: [makeText('b', 'body')] }))).toBe('')
  })

  it('elementText covers every element type', () => {
    const els = deck.slides[2].elements
    const byId = (id: string) => elementText(els.find((e) => e.id === id)!)
    expect(byId('s3-keywords')).toBe('chlorophyll, glucose, endothermic')
    expect(byId('s3-photo')).toBe('Photo: leaf in sunlight')
    expect(byId('s3-mwb')).toMatch(/^Mini-whiteboards:/)
    expect(byId('s3-band')).toBe('')
    expect(
      elementText({ id: 'i', type: 'image', x: 0, y: 0, w: 1, h: 1, fit: 'cover', alt: 'A leaf' })
    ).toBe('A leaf')
    expect(
      elementText({
        id: 'd',
        type: 'diagram',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        svg: '',
        alt: 'Cell diagram'
      })
    ).toBe('Cell diagram')
    expect(
      elementText({
        id: 't',
        type: 'table',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        headerRow: true,
        rows: [
          ['a', 'b'],
          ['c', 'd']
        ]
      })
    ).toBe('a | b\nc | d')
  })
})

describe('deckOutline', () => {
  const deck = fixtureDeck()

  it('lists slides with ids, kinds, titles and element handles', () => {
    const outline = deckOutline(deck)
    expect(outline).toMatchObject({ deckId: deck.id, title: deck.title })
    expect(outline.slides).toHaveLength(3)
    expect(outline.slides[2]).toMatchObject({
      number: 3,
      id: 's3',
      kind: 'objectives',
      hasNotes: true
    })
    expect(outline.slides[2].title).toBe('What do plants need to make food?')
    const photo = outline.slides[2].elements.find((e) => e.id === 's3-photo')
    expect(photo).toMatchObject({
      type: 'image',
      name: 'photo',
      preview: 'Photo: leaf in sunlight'
    })
    expect(outline.slides[0].elements[0]).toMatchObject({ id: 's1-band', locked: true })
  })

  it('flags elements that do not fit', () => {
    const outline = deckOutline(deck, { doesntFit: new Set(['s3-los']) })
    const flagged = outline.slides.flatMap((s) => s.elements).filter((e) => e.doesntFit)
    expect(flagged.map((e) => e.id)).toEqual(['s3-los'])
    expect(
      deckOutline(deck, { doesntFit: ['s2-qs'] }).slides[1].elements.find((e) => e.id === 's2-qs')
        ?.doesntFit
    ).toBe(true)
  })

  it('truncates long previews and omits optional keys when not set', () => {
    const slide = makeSlide('s', { elements: [makeText('t', 'x'.repeat(200))] })
    const outline = deckOutline({ ...deck, slides: [slide] })
    expect(outline.slides[0].elements[0].preview).toHaveLength(60)
    expect(outline.slides[0].elements[0].preview.endsWith('…')).toBe(true)
    expect(outline.slides[0].elements[0]).not.toHaveProperty('locked')
    expect(outline.slides[0].elements[0]).not.toHaveProperty('name')
    expect(outline.slides[0].hasNotes).toBe(false)
  })

  it('renders compact prompt text', () => {
    const text = outlineText(deckOutline(deck, { doesntFit: ['s3-los'] }))
    expect(text.split('\n')[0]).toBe(`Deck "${deck.title}" (${deck.id})`)
    expect(text).toContain('3. [s3] objectives: What do plants need to make food? (notes)')
    expect(text).toContain(
      `- s3-los text "objectives list" (doesn't fit): Describe where photosynthesis`
    )
    expect(text).toContain('- s1-band shape (locked):')
    expect(outlineText(deckOutline({ ...deck, slides: [makeSlide('x')] }))).toContain(
      'x] content: (no title)'
    )
  })
})
