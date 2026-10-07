import { describe, expect, it } from 'vitest'
import { applyChangeSet } from '../deck/apply'
import { fixtureDeck, fixedClock, makeChangeSet } from '../deck/testing'
import type { Deck, ImageElement, Slide } from '../deck/types'
import { creditLine } from './credits'
import { buildPlaceOps, resolvePlacement } from './place'
import {
  countPictureSpots,
  isPictureSpot,
  listPictureSpots,
  nextSpot,
  spotInfo,
  spotsPerSlide
} from './spots'

const spot = (id: string, over: Partial<ImageElement> = {}): ImageElement => ({
  id,
  type: 'image',
  x: 1100,
  y: 240,
  w: 600,
  h: 450,
  fit: 'cover',
  alt: 'A leaf in sunlight, close up',
  placeholder: { description: 'A leaf in sunlight, close up' },
  ...over
})

const picture = (id: string): ImageElement => ({
  ...spot(id),
  assetId: 'ast_existing',
  placeholder: undefined
})

const deckWith = (...slides: Slide[]): Deck => {
  const deck = fixtureDeck()
  return { ...deck, slides }
}

const slideA: Slide = {
  id: 'sld_a',
  kind: 'content',
  elements: [spot('el_spot1'), picture('el_pic')]
}
const slideB: Slide = {
  id: 'sld_b',
  kind: 'content',
  elements: [spot('el_spot2'), spot('el_spot3')]
}

describe('picture spots', () => {
  it('recognises an empty image with a placeholder and nothing else', () => {
    expect(isPictureSpot(spot('a'))).toBe(true)
    expect(isPictureSpot(picture('b'))).toBe(false)
    expect(isPictureSpot({ ...spot('c'), placeholder: undefined })).toBe(false)
    expect(isPictureSpot({ ...spot('d'), assetId: 'ast_1' })).toBe(false)
  })

  it('reads hints and tolerates an old placeholder with only a description', () => {
    expect(spotInfo(spot('a'))).toEqual({ description: 'A leaf in sunlight, close up' })
    const rich = spot('b', {
      placeholder: {
        description: 'Cave painting',
        kind: 'photo',
        query: 'cave painting lascaux',
        suggestedAssets: ['ast_9']
      } as ImageElement['placeholder']
    })
    expect(spotInfo(rich)).toEqual({
      description: 'Cave painting',
      kind: 'photo',
      query: 'cave painting lascaux',
      suggestedAssets: ['ast_9']
    })
  })

  it('lists spots in slide order with their place in the lesson', () => {
    const spots = listPictureSpots([slideA, slideB])
    expect(spots.map((s) => [s.slideNumber, s.elementId, s.index, s.total])).toEqual([
      [1, 'el_spot1', 1, 3],
      [2, 'el_spot2', 2, 3],
      [2, 'el_spot3', 3, 3]
    ])
    expect(spots[0]).toMatchObject({ query: 'A leaf in sunlight, close up', kind: null })
    expect(countPictureSpots([slideA, slideB])).toBe(3)
    expect([...spotsPerSlide([slideA, slideB])]).toEqual([
      [1, 1],
      [2, 2]
    ])
  })

  it('picks the next spot after a fill (index slides in) or a skip (index moves on) and wraps', () => {
    const three = listPictureSpots([slideA, slideB])
    expect(nextSpot(three, 1, 'skipped')?.elementId).toBe('el_spot2')
    expect(nextSpot(three, 3, 'skipped')?.elementId).toBe('el_spot1')
    const afterFillingFirst = three.slice(1)
    expect(nextSpot(afterFillingFirst, 1, 'filled')?.elementId).toBe('el_spot2')
    const afterFillingLast = three.slice(0, 2)
    expect(nextSpot(afterFillingLast, 3, 'filled')?.elementId).toBe('el_spot1')
    expect(nextSpot([], 1, 'filled')).toBeUndefined()
  })
})

describe('resolvePlacement', () => {
  const image = { width: 800, height: 600 }

  it('fits a spot inside its own box and replaces it', () => {
    const result = resolvePlacement(slideA, image, { kind: 'spot', elementId: 'el_spot1' }, 'fit')
    expect(result).toMatchObject({
      replaceElementId: 'el_spot1',
      box: { fit: 'contain', w: 600, h: 450 }
    })
  })

  it('refuses a spot that is gone, a filled picture or a locked one', () => {
    expect(
      resolvePlacement(slideA, image, { kind: 'spot', elementId: 'nope' }, 'fit')
    ).toHaveProperty('error')
    expect(
      resolvePlacement(slideA, image, { kind: 'spot', elementId: 'el_pic' }, 'fit')
    ).toHaveProperty('error')
    const locked: Slide = { ...slideA, elements: [spot('el_l', { locked: true })] }
    expect(
      resolvePlacement(locked, image, { kind: 'spot', elementId: 'el_l' }, 'fit')
    ).toHaveProperty('error')
  })

  it('swaps only an unlocked image under a circle', () => {
    const region = {
      kind: 'region' as const,
      path: [
        [1100, 240],
        [1700, 240],
        [1700, 690],
        [1100, 690]
      ] as [number, number][],
      bbox: { x: 1100, y: 240, w: 600, h: 450 }
    }
    expect(
      resolvePlacement(slideA, image, { ...region, replaceElementId: 'el_pic' }, 'fill')
    ).toMatchObject({
      replaceElementId: 'el_pic',
      box: { fit: 'cover' }
    })
    expect(
      resolvePlacement(slideA, image, { ...region, replaceElementId: 'missing' }, 'fill')
    ).toMatchObject({
      replaceElementId: null
    })
    expect(
      resolvePlacement(slideA, image, { ...region, replaceElementId: null }, 'fit')
    ).toMatchObject({
      replaceElementId: null
    })
  })

  it('places by anchor and into a box', () => {
    const corner = resolvePlacement(
      slideA,
      image,
      { kind: 'anchor', anchor: 'top-right', widthUnits: 240 },
      'fit'
    )
    expect(corner).toMatchObject({
      replaceElementId: null,
      box: { x: 1920 - 48 - 240, y: 48, w: 240, h: 180 }
    })
    const inBox = resolvePlacement(
      slideA,
      image,
      { kind: 'box', box: { x: 0, y: 0, w: 400, h: 400 } },
      'fit'
    )
    expect(inBox).toMatchObject({ box: { w: 400, h: 300 } })
  })
})

describe('buildPlaceOps applied to a real deck', () => {
  const image = { width: 800, height: 600 }
  const base = deckWith(slideA, slideB)

  it('fills a spot in place: same element id, assetId set, placeholder kept, one undo step', () => {
    const placement = resolvePlacement(
      slideA,
      image,
      { kind: 'spot', elementId: 'el_spot1' },
      'fill'
    )
    if ('error' in placement) throw new Error(placement.error)
    const ops = buildPlaceOps({
      slide: slideA,
      placement,
      assetId: 'ast_leaf',
      alt: 'A leaf in sunlight',
      name: 'leaf_in_sunlight',
      newElementId: 'el_new'
    })
    expect(ops).toHaveLength(1)
    const applied = applyChangeSet(base, makeChangeSet(ops), { clock: fixedClock })
    if (!applied.ok) throw new Error(applied.errors.join('; '))
    const element = applied.deck.slides[0]?.elements.find(
      (e) => e.id === 'el_spot1'
    ) as ImageElement
    expect(element).toMatchObject({ assetId: 'ast_leaf', fit: 'cover', name: 'leaf_in_sunlight' })
    expect(element.placeholder?.description).toBe('A leaf in sunlight, close up')
    expect(isPictureSpot(element)).toBe(false)
    expect(countPictureSpots(applied.deck.slides)).toBe(2)
  })

  it('adds a new element for a corner placement and appends the credit line once', () => {
    const line = creditLine({
      credit: {
        text: '"Volcano cross-section" by A. Author, CC BY-SA 4.0. Source: Wikimedia Commons (https://commons.example/volcano).',
        inNotes: true,
        provider: 'wikimedia',
        author: 'A. Author',
        title: null,
        pageUrl: 'https://commons.example/volcano',
        licenceUrl: null
      }
    })
    const withNotes: Slide = { ...slideA, notes: 'Start with the diagram.' }
    const placement = resolvePlacement(
      withNotes,
      image,
      { kind: 'anchor', anchor: 'top-right' },
      'fit'
    )
    if ('error' in placement) throw new Error(placement.error)
    const ops = buildPlaceOps({
      slide: withNotes,
      placement,
      assetId: 'ast_volcano',
      alt: 'Volcano cross-section',
      name: 'volcano_cross_section',
      newElementId: 'el_new',
      creditLine: line
    })
    expect(ops.map((op) => op.op)).toEqual(['addElement', 'updateSlide'])
    const applied = applyChangeSet(deckWith(withNotes, slideB), makeChangeSet(ops), {
      clock: fixedClock
    })
    if (!applied.ok) throw new Error(applied.errors.join('; '))
    const slide = applied.deck.slides[0]
    expect(slide?.elements.at(-1)).toMatchObject({
      id: 'el_new',
      type: 'image',
      assetId: 'ast_volcano'
    })
    expect(slide?.notes).toBe(
      'Start with the diagram.\nPicture credit: "Volcano cross-section" by A. Author, CC BY-SA 4.0. Source: Wikimedia Commons (https://commons.example/volcano).'
    )
    const again = buildPlaceOps({
      slide: slide as Slide,
      placement,
      assetId: 'ast_volcano',
      alt: 'x',
      name: 'volcano_cross_section',
      newElementId: 'el_new2',
      creditLine: line
    })
    expect(again.map((op) => op.op)).toEqual(['addElement'])
  })
})
