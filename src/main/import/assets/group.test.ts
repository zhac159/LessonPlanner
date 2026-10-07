import { describe, expect, it } from 'vitest'
import { groupFindings } from './group'
import { rng } from './testRasters'
import type { ExtractedImage } from './types'

const hex = (n: number, length: number) => n.toString(16).padStart(length, '0').slice(-length)
let counter = 0

/** Different seeds give hashes that differ in about half of their bits. */
function randomHex(seed: number, length: number): string {
  const rand = rng(seed)
  return Array.from({ length }, () => Math.floor(rand() * 16).toString(16)).join('')
}

/** A complete ExtractedImage with sensible defaults; hashes derive from `look` so equal looks are exact copies. */
function fake(patch: Partial<ExtractedImage> & { look?: number } = {}): ExtractedImage {
  const { look = ++counter, ...rest } = patch
  const id = `f#${++counter}`
  return {
    id,
    fileName: 'a.pptx',
    sourceKind: 'pptx',
    pageOrSlide: 1,
    origin: 'slide',
    bytes: new Uint8Array([look]),
    mime: 'image/png',
    width: 400,
    height: 300,
    hash: hex(look, 64),
    perceptualHash: randomHex(look, 16),
    detailHash: randomHex(look + 1000, 64),
    colorSignature: '80'.repeat(27),
    box: { x: 100, y: 100, w: 600, h: 450 },
    rotation: 0,
    repeatedOn: [1],
    nearbyText: '',
    slideText: '',
    kindHint: 'photo',
    kindReasons: [],
    cardCount: 0,
    quality: {
      tooSmall: false,
      thin: false,
      lowResolution: false,
      blurry: false,
      blurScore: 100,
      fullPage: false,
      unreadable: false
    },
    maybePupils: false,
    pupilReasons: [],
    ...rest
  }
}

describe('groupFindings', () => {
  it('merges exact copies into one asset and counts the pages it is found on', () => {
    const logo = (page: number) =>
      fake({
        look: 7,
        pageOrSlide: page,
        repeatedOn: [1, 2, 3, 4],
        kindHint: 'logo',
        box: { x: 1600, y: 0, w: 200, h: 120 }
      })
    const findings = groupFindings([logo(1), logo(2), logo(3), logo(4), fake({ look: 90 })])
    expect(findings.found).toBe(2)
    const merged = findings.assets.find((a) => a.kind === 'logo')
    expect(merged?.foundOn).toBe(4)
    expect(merged?.occurrenceIds).toHaveLength(4)
    expect(merged?.suggestedName).toBe('school_logo')
  })

  it('merges across files and lists where it was found', () => {
    const a = fake({ look: 5, fileName: 'a.pptx', pageOrSlide: 2, repeatedOn: [2, 3] })
    const b = fake({
      look: 5,
      fileName: 'b.pdf',
      sourceKind: 'pdf',
      pageOrSlide: 6,
      repeatedOn: [6]
    })
    const [asset] = groupFindings([a, b]).assets
    expect(asset.foundIn).toEqual([
      { fileName: 'a.pptx', units: [2, 3] },
      { fileName: 'b.pdf', units: [6] }
    ])
    expect(asset.foundOn).toBe(3)
  })

  it('keeps the largest copy as the representative', () => {
    const small = fake({ look: 5, width: 100, height: 80 })
    const big = fake({ look: 5, width: 800, height: 600 })
    expect(groupFindings([small, big]).assets[0].image.id).toBe(big.id)
  })

  it('ignores specks, lines and page scans, counting each distinct one once', () => {
    const q = (patch: object) => ({ ...fake().quality, ...patch })
    const findings = groupFindings([
      fake({ look: 1, quality: q({ tooSmall: true }) }),
      fake({ look: 1, quality: q({ tooSmall: true }) }),
      fake({ look: 2, quality: q({ thin: true }) }),
      fake({ look: 3, quality: q({ fullPage: true }) }),
      fake({ look: 4 })
    ])
    expect(findings.ignored).toEqual({ tooSmall: 1, thin: 1, fullPage: 1 })
    expect(findings.found).toBe(1)
  })

  it('leaves out possible pupil photos for review and says why', () => {
    const pupils = fake({
      look: 11,
      maybePupils: true,
      pupilReasons: ['class words near it', 'portrait shape']
    })
    const [asset] = groupFindings([pupils]).assets
    expect(asset.keep).toBe(false)
    expect(asset.leftOut).toBe('pupils')
    expect(asset.needsReview).toBe(true)
    expect(asset.reviewReasons).toContain('portrait shape')
  })

  it('leaves out blurry pictures, unreadable ones, backgrounds and low resolution photos', () => {
    const q = (patch: object) => ({ ...fake().quality, ...patch })
    const findings = groupFindings([
      fake({ look: 21, quality: q({ blurry: true, blurScore: 8 }) }),
      fake({ look: 22, quality: q({ unreadable: true }) }),
      fake({ look: 23, origin: 'background' }),
      fake({ look: 24, quality: q({ lowResolution: true }) }),
      fake({ look: 25, kindHint: 'icon', quality: q({ lowResolution: true }) })
    ])
    const reasons = Object.fromEntries(
      findings.assets.map((a) => [a.image.hash.slice(-2), a.leftOut ?? 'keep'])
    )
    expect(reasons).toEqual({
      '15': 'blurry',
      '16': 'unreadable',
      '17': 'background',
      '18': 'low-resolution',
      '19': 'keep'
    })
    expect(findings.keeping).toBe(1)
    expect(findings.found).toBe(5)
  })

  it('marks a near duplicate as an older version of the better known picture', () => {
    const main = fake({ look: 31, repeatedOn: [1, 2, 3], kindHint: 'logo' })
    const older = fake({
      look: 32,
      perceptualHash: main.perceptualHash,
      detailHash: main.detailHash,
      width: 398,
      height: 301
    })
    const findings = groupFindings([older, main])
    const olderAsset = findings.assets.find((a) => a.image.id === older.id)
    const mainAsset = findings.assets.find((a) => a.image.id === main.id)
    expect(olderAsset?.leftOut).toBe('older-version')
    expect(olderAsset?.olderVersionOf).toBe(mainAsset?.id)
    expect(olderAsset?.reviewReasons).toContain(`Older version of ${mainAsset?.suggestedName}`)
    expect(mainAsset?.keep).toBe(true)
  })

  it('does not treat pictures with a different colour scheme as versions of each other', () => {
    const a = fake({ look: 41 })
    const b = fake({
      look: 42,
      perceptualHash: a.perceptualHash,
      detailHash: a.detailHash,
      colorSignature: 'f0'.repeat(27)
    })
    const findings = groupFindings([a, b])
    expect(findings.assets.every((x) => x.keep)).toBe(true)
  })

  it('proposes unique snake_case names from alt text, short labels or the kind and page', () => {
    const findings = groupFindings([
      fake({ look: 51, altText: 'Owl Mascot!' }),
      fake({ look: 52, nearbyText: 'elk' }),
      fake({ look: 53, nearbyText: 'elk' }),
      fake({ look: 54, nearbyText: 'What do you think these illustrations are?', pageOrSlide: 7 }),
      fake({ look: 55, nearbyText: '3 apples' }),
      fake({ look: 56, kindHint: 'logo', repeatedOn: [1, 2, 3] }),
      fake({ look: 57, kindHint: 'logo', repeatedOn: [1, 2, 3] })
    ])
    const names = findings.assets.map((a) => a.suggestedName).sort()
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain('owl_mascot')
    expect(names).toContain('elk')
    expect(names).toContain('elk_2')
    expect(names).toContain('photo_p7')
    expect(names).toContain('photo_3_apples')
    expect(names).toContain('school_logo')
    expect(names).toContain('logo')
    expect(names.every((n) => /^[a-z][a-z0-9_]*$/.test(n))).toBe(true)
  })

  it('orders ticked assets first, the most widespread first', () => {
    const findings = groupFindings([
      fake({ look: 61, maybePupils: true, pupilReasons: ['x'], repeatedOn: [1, 2, 3, 4, 5] }),
      fake({ look: 62 }),
      fake({ look: 63, repeatedOn: [1, 2, 3], kindHint: 'logo' })
    ])
    expect(findings.assets.map((a) => a.keep)).toEqual([true, true, false])
    expect(findings.assets[0].kind).toBe('logo')
  })

  it('handles an empty list', () => {
    expect(groupFindings([])).toEqual({
      assets: [],
      ignored: { tooSmall: 0, thin: 0, fullPage: 0 },
      found: 0,
      keeping: 0
    })
  })
})
