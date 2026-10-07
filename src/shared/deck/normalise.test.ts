import { describe, expect, it } from 'vitest'
import { clampBox, normaliseDeck } from './normalise'
import { fixtureDeck, makeSlide, makeText } from './testing'
import type { Deck, Element } from './types'

const deckWith = (...elements: Element[]): Deck => ({
  ...fixtureDeck(),
  slides: [makeSlide('s1', { elements })]
})
const firstElement = (deck: Deck): Element => deck.slides[0].elements[0]

describe('clampBox', () => {
  it('moves boxes that overflow back inside the slide', () => {
    const box = { x: 1800, y: 1000, w: 400, h: 300 }
    clampBox(box)
    expect(box).toEqual({ x: 1520, y: 780, w: 400, h: 300 })
  })

  it('pulls negative positions to 0 and shrinks oversized boxes', () => {
    const box = { x: -50, y: -5, w: 5000, h: 2000 }
    clampBox(box)
    expect(box).toEqual({ x: 0, y: 0, w: 1920, h: 1080 })
  })

  it('never lets a box collapse below 1 unit (horizontal lines keep a hairline)', () => {
    const box = { x: 10, y: 10, w: 0, h: 0 }
    clampBox(box)
    expect(box.w).toBe(1)
    expect(box.h).toBe(1)
  })
})

describe('normaliseDeck', () => {
  it('leaves the fixture untouched (same object back)', () => {
    const deck = fixtureDeck()
    expect(normaliseDeck(deck)).toBe(deck)
  })

  it('drops empty runs but keeps the paragraph', () => {
    const el = makeText('t', 'x', {
      paragraphs: [{ runs: [{ text: '' }, { text: 'Hi' }, { text: '' }] }, { runs: [{ text: '' }] }]
    })
    const out = firstElement(normaliseDeck(deckWith(el)))
    expect(out.type === 'text' && out.paragraphs).toEqual([
      { runs: [{ text: 'Hi' }] },
      { runs: [] }
    ])
  })

  it('gives empty ids a fresh id and de-duplicates ids within a slide (first wins)', () => {
    const ids = normaliseDeck(
      deckWith(makeText('same', 'a'), makeText('same', 'b'), makeText('', 'c'))
    ).slides[0].elements.map((e) => e.id)
    expect(ids[0]).toBe('same')
    expect(new Set(ids).size).toBe(3)
    expect(ids[1]).toMatch(/^el_/)
    expect(ids[2]).toMatch(/^el_/)
  })

  it('de-duplicates slide ids', () => {
    const deck = { ...fixtureDeck(), slides: [makeSlide('x'), makeSlide('x'), makeSlide('')] }
    const ids = normaliseDeck(deck).slides.map((s) => s.id)
    expect(ids[0]).toBe('x')
    expect(new Set(ids).size).toBe(3)
  })

  it('drops empty chips', () => {
    const chips: Element = {
      id: 'c',
      type: 'chips',
      x: 0,
      y: 0,
      w: 500,
      h: 60,
      items: ['a', ' ', '', 'b']
    }
    const out = firstElement(normaliseDeck(deckWith(chips)))
    expect(out.type === 'chips' && out.items).toEqual(['a', 'b'])
  })

  describe('table column widths', () => {
    const table = (colWidths: number[]): Element => ({
      id: 't',
      type: 'table',
      x: 0,
      y: 0,
      w: 600,
      h: 200,
      headerRow: true,
      rows: [
        ['a', 'b'],
        ['c', 'd']
      ],
      colWidths
    })
    const widthsAfter = (colWidths: number[]) => {
      const el = firstElement(normaliseDeck(deckWith(table(colWidths))))
      return el.type === 'table' ? el.colWidths : undefined
    }

    it('scales widths to sum to the element width', () => {
      expect(widthsAfter([100, 200])).toEqual([200, 400])
    })
    it('keeps widths that already fit (within 1 unit)', () => {
      expect(widthsAfter([300, 300.5])).toEqual([300, 300.5])
    })
    it('drops widths with the wrong column count or no width', () => {
      expect(widthsAfter([600])).toBeUndefined()
      expect(widthsAfter([0, 0])).toBeUndefined()
    })
  })

  it('clamps element boxes', () => {
    const out = firstElement(normaliseDeck(deckWith(makeText('t', 'x', { x: 1900, w: 500 }))))
    expect(out.x + out.w).toBeLessThanOrEqual(1920)
  })
})
