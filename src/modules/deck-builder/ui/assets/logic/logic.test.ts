import { describe, expect, it } from 'vitest'
import type { SpotRef } from '@shared/assets/spots'
import { makeSlide } from '@shared/deck/testing'
import type { ImageElement } from '@shared/deck/types'
import {
  removeAssetToken,
  unknownNamesLine,
  typedTokenAt,
  finishTypedToken
} from './composerTokens'
import { assumedSize, previewBox, previewTag, regionTarget } from './preview'
import { placeLabel, snapshotPosition, spotAfter, spotSubtitle } from './spotFlow'

const spot = (index: number, total: number, elementId = `e${index}`): SpotRef => ({
  slideId: 's1',
  slideNumber: index,
  elementId,
  description: 'A leaf in sunlight, close up',
  kind: null,
  query: 'leaf',
  suggestedAssets: [],
  box: { x: 0, y: 0, w: 100, h: 100 },
  index,
  total
})

describe('composer tokens', () => {
  it('removes a token and the space before it', () => {
    expect(removeAssetToken('Put {{school_logo}} top right', 'school_logo')).toBe('Put top right')
    expect(removeAssetToken('{{Owl}} hi', 'owl')).toBe('hi')
  })
  it('finds and finishes the open token', () => {
    expect(typedTokenAt('Put {{sch', 9)).toEqual({ start: 4, query: 'sch' })
    expect(typedTokenAt('Put sch', 7)).toBeNull()
    expect(finishTypedToken('Put {{sch', 9, 'school_logo')?.text).toBe('Put {{school_logo}} ')
  })
  it('words the unknown names', () => {
    expect(unknownNamesLine([])).toBe('')
    expect(unknownNamesLine(['owl'])).toBe('No asset called owl.')
    expect(unknownNamesLine(['owl', 'sun'])).toBe('No asset called owl or sun.')
  })
})

describe('spot flow', () => {
  it('reads "k of N" from the snapshot, whatever the live count is', () => {
    expect(snapshotPosition(['a', 'b', 'c'], 'b')).toEqual({ k: 2, n: 3 })
    expect(snapshotPosition(['a'], 'z')).toEqual({ k: 2, n: 2 })
    expect(spotSubtitle(spot(3, 3), 1, 3)).toBe('“A leaf in sunlight, close up” · slide 3 · 1 of 3')
  })
  it('opens the next spot after a fill, wrapping, and closes when none is left', () => {
    const live = [spot(1, 2, 'a'), spot(2, 2, 'b')]
    expect(spotAfter(live, { index: 3, total: 3 }, 'filled')?.elementId).toBe('a')
    expect(spotAfter([], { index: 1, total: 1 }, 'filled')).toBeNull()
  })
  it('skips to the next spot and closes on the last one', () => {
    const live = [spot(1, 3, 'a'), spot(2, 3, 'b'), spot(3, 3, 'c')]
    expect(spotAfter(live, { index: 1, total: 3 }, 'skipped')?.elementId).toBe('b')
    expect(spotAfter(live, { index: 3, total: 3 }, 'skipped')).toBeNull()
  })
  it('labels the primary button', () => {
    expect(placeLabel(3)).toBe('Place it · next spot')
    expect(placeLabel(1)).toBe('Place it')
  })
})

describe('preview', () => {
  const image: ImageElement = {
    id: 'spot1',
    type: 'image',
    x: 1000,
    y: 200,
    w: 600,
    h: 500,
    fit: 'cover',
    alt: 'A leaf',
    placeholder: { description: 'A leaf in sunlight' }
  }
  const slide = makeSlide('s1', { elements: [image] })
  it('fits a picture inside a spot and fills it', () => {
    const target = { kind: 'spot' as const, elementId: 'spot1' }
    const fit = previewBox(slide, { width: 800, height: 400 }, target, 'fit')
    expect(fit?.replaceElementId).toBe('spot1')
    expect(fit?.box.fit).toBe('contain')
    expect(fit?.box.w).toBeCloseTo(600)
    const fill = previewBox(slide, { width: 800, height: 400 }, target, 'fill')
    expect(fill?.box).toMatchObject({ x: 1000, y: 200, w: 600, h: 500, fit: 'cover' })
  })
  it('returns null when the spot is gone', () => {
    expect(
      previewBox(slide, { width: 10, height: 10 }, { kind: 'spot', elementId: 'x' }, 'fit')
    ).toBeNull()
  })
  it('keeps the loop inside the region target and names the tag', () => {
    const target = regionTarget(
      {
        path: [
          [0, 0],
          [400, 0],
          [400, 400],
          [0, 400]
        ],
        bbox: { x: 0, y: 0, w: 400, h: 400 }
      },
      null
    )
    const placed = previewBox(slide, { width: 100, height: 100 }, target, 'fit')
    const x = placed?.box.x ?? -1
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x + (placed?.box.w ?? 0)).toBeLessThanOrEqual(400)
    expect(previewTag('leaf_cross_section', 'fit', 'region 1')).toBe(
      'leaf_cross_section · fitted to region 1'
    )
    expect(previewTag('leaf_cross_section', 'fill', 'region 1')).toBe(
      'leaf_cross_section · filling region 1'
    )
  })
  it('assumes a shape per kind', () => {
    expect(assumedSize('icon')).toEqual({ width: 400, height: 400 })
    expect(assumedSize('banner').width).toBeGreaterThan(assumedSize('banner').height * 2)
  })
})
