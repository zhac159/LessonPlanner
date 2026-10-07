import { describe, expect, it } from 'vitest'
import { isPictureSpot, spotInfo } from '../assets/spots'
import { parseDeck, slideSchema } from './schema'
import { fixtureDeck, makeSlide } from './testing'
import type { CalloutElement, ImageElement } from './types'

const spot = (placeholder: ImageElement['placeholder']): ImageElement => ({
  id: 'img1',
  type: 'image',
  x: 0,
  y: 0,
  w: 400,
  h: 300,
  fit: 'cover',
  alt: 'A leaf',
  placeholder
})

describe('picture spot model (placeholder extension)', () => {
  it('keeps every existing deck valid, including its old `{ description }` placeholders', () => {
    const deck = fixtureDeck()
    const old = deck.slides.flatMap((s) => s.elements).filter((e) => e.type === 'image')
    expect(old.some((e) => (e as ImageElement).placeholder)).toBe(true)
    const parsed = parseDeck(deck)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value).toEqual(deck)
  })

  it('accepts kind, query and suggestedAssets and keeps them', () => {
    const slide = makeSlide('s1', {
      elements: [
        spot({
          description: 'A leaf in sunlight, close up',
          kind: 'photo',
          query: 'leaf sunlight',
          suggestedAssets: ['ast_1']
        })
      ]
    })
    const parsed = slideSchema.safeParse(slide)
    expect(parsed.success).toBe(true)
    const element = parsed.success ? (parsed.data.elements[0] as ImageElement) : null
    expect(element && isPictureSpot(element)).toBe(true)
    expect(element && spotInfo(element)).toEqual({
      description: 'A leaf in sunlight, close up',
      kind: 'photo',
      query: 'leaf sunlight',
      suggestedAssets: ['ast_1']
    })
  })

  it('rejects an unknown kind and a placeholder without a description', () => {
    const bad = (placeholder: unknown) =>
      slideSchema.safeParse(makeSlide('s1', { elements: [spot(placeholder as never)] })).success
    expect(bad({ description: 'x', kind: 'sticker' })).toBe(false)
    expect(bad({ kind: 'photo' })).toBe(false)
  })

  it('a filled spot keeps its placeholder as provenance and is no longer a spot', () => {
    const filled: ImageElement = { ...spot({ description: 'A leaf' }), assetId: 'ast_1' }
    expect(isPictureSpot(filled)).toBe(false)
    expect(slideSchema.safeParse(makeSlide('s1', { elements: [filled] })).success).toBe(true)
  })

  it('accepts a speech-bubble callout with a tail hint and rejects an unknown tail', () => {
    const bubble = (tail: string): CalloutElement =>
      ({
        id: 'c1',
        type: 'callout',
        variant: 'speech-bubble',
        x: 0,
        y: 0,
        w: 600,
        h: 280,
        paragraphs: [],
        tail
      }) as CalloutElement
    const ok = (tail: string) =>
      slideSchema.safeParse(makeSlide('s1', { elements: [bubble(tail)] })).success
    expect(ok('bottom-left')).toBe(true)
    expect(ok('none')).toBe(true)
    expect(ok('upside-down')).toBe(false)
  })
})
