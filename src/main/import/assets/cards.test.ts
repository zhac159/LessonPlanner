import { describe, expect, it } from 'vitest'
import { cropSymbolCards, detectCards, labelsFromText, splitCardsFromRaster } from './cards'
import { decodePng } from './png'
import { cardSheet, makeRaster, photoRaster, pngOf } from './testRasters'

describe('cropSymbolCards (experimental)', () => {
  it('splits a 3 x 2 grid into six cards in reading order', () => {
    const split = splitCardsFromRaster(cardSheet({ cols: 3, rows: 2 }))
    expect(split.experimental).toBe(true)
    expect(split.cards).toHaveLength(6)
    expect(split.cards.map((c) => `${c.row}.${c.col}`)).toEqual([
      '0.0',
      '0.1',
      '0.2',
      '1.0',
      '1.1',
      '1.2'
    ])
    expect(split.confidence).toBeGreaterThan(0.9)
    for (const card of split.cards) {
      expect(card.width).toBeGreaterThanOrEqual(90)
      expect(card.width).toBeLessThan(105)
      expect(card.height).toBeGreaterThanOrEqual(100)
      expect(card.mime).toBe('image/png')
      expect(decodePng(card.bytes).width).toBe(card.width)
    }
  })

  it('splits a strip whose cards touch the picture edge', () => {
    const split = splitCardsFromRaster(cardSheet({ cols: 3, rows: 1, margin: 0, gap: 6 }))
    expect(split.cards).toHaveLength(3)
    expect(split.cards.map((c) => c.col)).toEqual([0, 1, 2])
  })

  it('works on a coloured plain background and with tightly packed cards', () => {
    const split = splitCardsFromRaster(
      cardSheet({ cols: 2, rows: 2, background: [250, 230, 120], gap: 5, border: [90, 40, 20] })
    )
    expect(split.cards).toHaveLength(4)
  })

  it('returns nothing for a photo, a single card or two blobs', () => {
    expect(splitCardsFromRaster(photoRaster(300, 200, 3)).cards).toHaveLength(0)
    expect(splitCardsFromRaster(cardSheet({ cols: 1, rows: 1 })).cards).toHaveLength(0)
    const blobs = makeRaster(200, 120, (x, y) =>
      Math.hypot(x - 50, y - 60) < 40 || Math.hypot(x - 150, y - 60) < 40
        ? [30, 30, 30]
        : [255, 255, 255]
    )
    expect(splitCardsFromRaster(blobs).cards).toHaveLength(0)
    expect(splitCardsFromRaster(makeRaster(10, 10, () => [0, 0, 0])).cards).toHaveLength(0)
  })

  it('detects regions with scale information', () => {
    const found = detectCards(cardSheet({ cols: 2, rows: 1, cardWidth: 400, cardHeight: 300 }))
    expect(found.regions).toHaveLength(2)
    expect(found.scale).toBeGreaterThan(1)
  })

  it('labels cards from one line of text each, in reading order', () => {
    expect(labelsFromText('wolf\nuncle\nknife', 3)).toEqual(['wolf', 'uncle', 'knife'])
    expect(labelsFromText('a | b', 2)).toEqual(['a', 'b'])
    expect(labelsFromText('only one', 3)).toBeUndefined()
  })

  it('crops from encoded bytes and applies labels from the nearby text', async () => {
    const bytes = pngOf(cardSheet({ cols: 3, rows: 1 }))
    const labelled = await cropSymbolCards({
      bytes,
      mime: 'image/png',
      nearbyText: 'wolf\nuncle\nknife'
    })
    expect(labelled.cards.map((c) => c.label)).toEqual(['wolf', 'uncle', 'knife'])
    const given = await cropSymbolCards({ bytes, mime: 'image/png' }, { labels: ['x', 'y', 'z'] })
    expect(given.cards.map((c) => c.label)).toEqual(['x', 'y', 'z'])
    const plain = await cropSymbolCards({ bytes, mime: 'image/png' })
    expect(plain.cards.every((c) => c.label === undefined)).toBe(true)
    const broken = await cropSymbolCards({ bytes: new Uint8Array([1, 2, 3]), mime: 'image/png' })
    expect(broken.cards).toHaveLength(0)
  })
})
