import { describe, expect, it } from 'vitest'
import type { Analysis } from './analysis'
import { guessPupils, isPageLike, kindOf, qualityOf, repeatsWidely } from './classify'

const analysis = (patch: Partial<Analysis> = {}): Analysis => ({
  perceptualHash: '0'.repeat(16),
  detailHash: '0'.repeat(64),
  colorSignature: '00'.repeat(27),
  blurScore: 120,
  colorBins: 80,
  whiteFraction: 0.1,
  transparentFraction: 0,
  skinFraction: 0,
  edgeWhiteFraction: 0,
  edgePlainShare: 0.1,
  ...patch
})

const box = (w: number, h: number, x = 100, y = 100) => ({ x, y, w, h })

describe('repeatsWidely', () => {
  it('needs half the slides and at least three of them (two in a very short deck)', () => {
    expect(repeatsWidely([2, 3, 4, 5, 6], 10)).toBe(true)
    expect(repeatsWidely([2, 3], 10)).toBe(false)
    expect(repeatsWidely([1, 2, 3], 10)).toBe(false)
    expect(repeatsWidely([1, 2], 3)).toBe(true)
    expect(repeatsWidely([1], 1)).toBe(false)
    expect(repeatsWidely([1, 2, 3], 0)).toBe(false)
  })
})

describe('qualityOf', () => {
  const base = { origin: 'slide' as const, analysis: analysis() }

  it('flags tiny decorative bits and thin lines', () => {
    expect(qualityOf({ ...base, width: 30, height: 30, box: box(60, 60) }).tooSmall).toBe(true)
    expect(qualityOf({ ...base, width: 400, height: 400, box: box(40, 40) }).tooSmall).toBe(true)
    expect(qualityOf({ ...base, width: 400, height: 300, box: box(400, 300) }).tooSmall).toBe(false)
    expect(qualityOf({ ...base, width: 800, height: 20, box: box(800, 20) }).thin).toBe(true)
    expect(qualityOf({ ...base, width: 400, height: 3, box: box(400, 30) }).thin).toBe(true)
  })

  it('flags low resolution and blur', () => {
    expect(qualityOf({ ...base, width: 80, height: 80, box: box(200, 200) }).lowResolution).toBe(
      true
    )
    expect(qualityOf({ ...base, width: 150, height: 100, box: box(600, 400) }).lowResolution).toBe(
      true
    )
    expect(qualityOf({ ...base, width: 500, height: 400, box: box(600, 400) }).lowResolution).toBe(
      false
    )
    const blurry = qualityOf({
      ...base,
      analysis: analysis({ blurScore: 10 }),
      width: 500,
      height: 400,
      box: box(600, 400)
    })
    expect(blurry.blurry).toBe(true)
    expect(blurry.blurScore).toBe(10)
  })

  it('flags whole-page pictures but not backgrounds, and unreadable ones', () => {
    expect(
      qualityOf({ ...base, width: 1920, height: 1080, box: box(1900, 1060, 10, 10) }).fullPage
    ).toBe(true)
    expect(
      qualityOf({
        ...base,
        origin: 'background',
        width: 1920,
        height: 1080,
        box: box(1920, 1080, 0, 0)
      }).fullPage
    ).toBe(false)
    expect(isPageLike(box(1920, 814, 0, 132))).toBe(true)
    expect(isPageLike(box(1000, 700))).toBe(false)
    const unreadable = qualityOf({
      ...base,
      analysis: null,
      width: 0,
      height: 0,
      box: box(300, 300)
    })
    expect(unreadable.unreadable).toBe(true)
    expect(unreadable.blurry).toBe(false)
  })
})

describe('kindOf', () => {
  const input = {
    width: 400,
    height: 300,
    box: box(400, 300),
    origin: 'slide' as const,
    repeatedOn: [1],
    units: 10,
    analysis: analysis(),
    cardCount: 0,
    singleCard: false,
    nearbyText: '',
    isJpeg: true
  }

  it('calls a small picture that repeats on many slides a logo', () => {
    expect(kindOf({ ...input, box: box(200, 120), repeatedOn: [1, 2, 3, 4, 5, 6] }).kind).toBe(
      'logo'
    )
    expect(kindOf({ ...input, box: box(1500, 900), repeatedOn: [1, 2, 3, 4, 5, 6] }).kind).toBe(
      'photo'
    )
  })

  it('uses the master/layout, alt text, cards, shape and colours', () => {
    expect(kindOf({ ...input, box: box(150, 100), origin: 'master' }).kind).toBe('logo')
    expect(kindOf({ ...input, altText: 'School logo' }).kind).toBe('logo')
    expect(kindOf({ ...input, cardCount: 3 }).kind).toBe('symbol-card')
    expect(kindOf({ ...input, singleCard: true, width: 300 }).kind).toBe('symbol-card')
    expect(
      kindOf({ ...input, width: 1200, height: 200, analysis: analysis({ colorBins: 6 }) }).kind
    ).toBe('banner')
    expect(
      kindOf({
        ...input,
        width: 200,
        height: 200,
        analysis: analysis({ colorBins: 10, transparentFraction: 0.4 })
      }).kind
    ).toBe('icon')
    expect(kindOf({ ...input, analysis: analysis({ colorBins: 90 }) }).kind).toBe('photo')
    expect(kindOf({ ...input, analysis: null }).kind).toBe('other')
    expect(kindOf({ ...input, analysis: analysis({ colorBins: 30 }) }).kind).toBe('other')
  })

  it('explains itself', () => {
    expect(kindOf({ ...input, cardCount: 6 }).reasons[0]).toContain('6 cards')
  })
})

describe('guessPupils (heuristic)', () => {
  const photo = {
    kind: 'photo' as const,
    width: 300,
    height: 450,
    nearbyText: '',
    slideText: '',
    skinFraction: 0
  }

  it('is quiet for photos with no signs and for anything that is not a photo', () => {
    expect(guessPupils(photo).maybePupils).toBe(false)
    expect(guessPupils({ ...photo, kind: 'logo', nearbyText: 'our class' }).maybePupils).toBe(false)
    expect(guessPupils({ ...photo, height: 200, skinFraction: 0.5 }).maybePupils).toBe(false)
  })

  it('flags class words next to the photo, or two weaker signs together', () => {
    const near = guessPupils({ ...photo, height: 200, nearbyText: 'Year 6 pupils on the trip' })
    expect(near.maybePupils).toBe(true)
    expect(near.reasons).toContain('class words near it')
    expect(guessPupils({ ...photo, slideText: 'Our class assembly' }).maybePupils).toBe(true)
    expect(
      guessPupils({ ...photo, height: 200, slideText: 'Our class assembly' }).maybePupils
    ).toBe(false)
    expect(guessPupils({ ...photo, skinFraction: 0.5 }).maybePupils).toBe(true)
  })
})
