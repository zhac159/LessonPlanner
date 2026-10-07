import { describe, expect, it } from 'vitest'
import type { Element } from '@shared/deck/types'
import { exportSpotsStatus } from './spots'
import { deckWith } from './testkit'

const spot = (id: string): Element => ({
  id,
  type: 'image',
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  fit: 'cover',
  alt: id,
  placeholder: { description: `A ${id}` }
})

describe('exportSpotsStatus', () => {
  it('is null when nothing is empty (a filled spot keeps its placeholder but is a picture)', () => {
    expect(exportSpotsStatus(deckWith([]))).toBeNull()
    const filled = { ...spot('a'), assetId: 'ast_1' } as Element
    expect(exportSpotsStatus(deckWith([filled]))).toBeNull()
  })

  it('counts every empty spot and lists the slide numbers once each', () => {
    const deck = deckWith([spot('a'), spot('b')])
    deck.slides.push({ id: 's2', kind: 'content', elements: [] })
    deck.slides.push({ id: 's3', kind: 'content', elements: [spot('c')] })
    expect(exportSpotsStatus(deck)).toEqual({ status: 'spots', count: 3, slides: [1, 3] })
  })
})
