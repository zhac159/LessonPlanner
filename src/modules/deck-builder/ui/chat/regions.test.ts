import { describe, expect, it } from 'vitest'
import type { RegionDraft } from '@shared/contracts/deck-builder-chat'
import { captionOf, draftChips, sentRegions, slideNumberOf } from './regions'

const deck = { slides: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] } as never

const region = (n: number, slideId: string): RegionDraft => ({
  id: `r${n}`,
  n,
  slideId,
  path: [
    [0, 0],
    [10, 0],
    [10, 10]
  ],
  bbox: { x: 0, y: 0, w: 10, h: 10 },
  targetElementIds: []
})

describe('captionOf', () => {
  it('keeps a short message whole', () => {
    expect(captionOf('Swap this photo')).toBe('Swap this photo')
  })

  it('cuts a long one at a word boundary with an ellipsis', () => {
    expect(captionOf('Swap this photo for a labelled diagram of a leaf cross-section.')).toBe(
      'Swap this photo for a…'
    )
  })

  it('flattens line breaks', () => {
    expect(captionOf('Make\n\nit  bigger')).toBe('Make it bigger')
  })
})

describe('slideNumberOf', () => {
  it('is 1-based and null for a deleted slide', () => {
    expect(slideNumberOf(deck, 's3')).toBe(3)
    expect(slideNumberOf(deck, 'gone')).toBeNull()
  })
})

describe('draftChips', () => {
  it('lists the drafts in number order with their slide numbers', () => {
    expect(draftChips([region(2, 's3'), region(1, 's1')], deck)).toEqual([
      { id: 'r1', n: 1, slideNumber: 1 },
      { id: 'r2', n: 2, slideNumber: 3 }
    ])
  })
})

describe('sentRegions', () => {
  it('stores each region with its slide number and the message caption', () => {
    const [first] = sentRegions([region(1, 's2')], deck, 'Make this bigger please')
    expect(first).toMatchObject({
      n: 1,
      slideId: 's2',
      slideNumber: 2,
      caption: 'Make this bigger please'
    })
  })

  it('drops regions on slides that are gone', () => {
    expect(sentRegions([region(1, 'gone')], deck, 'x')).toEqual([])
  })
})
