import { describe, expect, it } from 'vitest'
import { analyse, colorDistance, hammingHex, resizeOverWhite, sha256 } from './analysis'
import { badgeRaster, blurRaster, cardSheet, makeRaster, photoRaster } from './testRasters'

describe('analysis', () => {
  it('hashes bytes with sha256', () => {
    expect(sha256(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })

  it('counts differing bits of hex hashes', () => {
    expect(hammingHex('ff', '0f')).toBe(4)
    expect(hammingHex('abcd', 'abcd')).toBe(0)
    expect(hammingHex('ab', 'abcd')).toBe(Infinity)
    expect(hammingHex('', '')).toBe(Infinity)
  })

  it('gives the same perceptual hash to one picture at different sizes', () => {
    const big = analyse(photoRaster(400, 300, 3))
    const small = analyse(photoRaster(400, 300, 3))
    expect(big.perceptualHash).toHaveLength(16)
    expect(big.detailHash).toHaveLength(64)
    expect(hammingHex(big.perceptualHash, small.perceptualHash)).toBe(0)
    // the same scene re-rendered smaller: shapes are scaled, so build it by resizing the pixels
    const raster = photoRaster(400, 300, 3)
    const thumb = resizeOverWhite(raster, 200, 150)
    const scaled = makeRaster(200, 150, (x, y) => {
      const i = (y * 200 + x) * 3
      return [thumb.rgb[i], thumb.rgb[i + 1], thumb.rgb[i + 2]]
    })
    expect(hammingHex(big.perceptualHash, analyse(scaled).perceptualHash)).toBeLessThanOrEqual(6)
    expect(colorDistance(big.colorSignature, analyse(scaled).colorSignature)).toBeLessThan(6)
  })

  it('tells different pictures apart', () => {
    const a = analyse(photoRaster(300, 200, 1))
    const b = analyse(photoRaster(300, 200, 2))
    expect(hammingHex(a.perceptualHash, b.perceptualHash)).toBeGreaterThan(10)
    expect(hammingHex(a.detailHash, b.detailHash)).toBeGreaterThan(40)
  })

  it('measures sharpness: a blurred copy scores lower and is below the blur line', () => {
    const sharp = photoRaster(300, 200, 7)
    const blurry = blurRaster(sharp, 3)
    const sharpScore = analyse(sharp).blurScore
    const blurScore = analyse(blurry).blurScore
    expect(sharpScore).not.toBeNull()
    expect(sharpScore as number).toBeGreaterThan(40)
    expect(blurScore === null || blurScore < 22).toBe(true)
  })

  it('has no sharpness figure for a flat picture', () => {
    expect(analyse(makeRaster(100, 100, () => [200, 200, 200])).blurScore).toBeNull()
  })

  it('reports colour statistics', () => {
    const badge = analyse(badgeRaster(100))
    expect(badge.transparentFraction).toBeGreaterThan(0.15)
    expect(badge.colorBins).toBeLessThan(10)
    expect(analyse(photoRaster(200, 200, 4)).colorBins).toBeGreaterThan(40)
    const cards = analyse(cardSheet({ cols: 2, rows: 1, margin: 10 }))
    expect(cards.edgePlainShare).toBeGreaterThan(0.95)
    expect(cards.edgeWhiteFraction).toBeGreaterThan(0.95)
  })

  it('treats transparency as white for hashing', () => {
    const transparent = analyse(badgeRaster(80, [20, 40, 110], true))
    const onWhite = analyse(badgeRaster(80, [20, 40, 110], false))
    expect(hammingHex(transparent.perceptualHash, onWhite.perceptualHash)).toBe(0)
  })

  it('compares colour signatures', () => {
    const red = analyse(makeRaster(30, 30, () => [200, 20, 20]))
    const blue = analyse(makeRaster(30, 30, () => [20, 20, 200]))
    expect(colorDistance(red.colorSignature, red.colorSignature)).toBe(0)
    expect(colorDistance(red.colorSignature, blue.colorSignature)).toBeGreaterThan(100)
    expect(colorDistance('', red.colorSignature)).toBe(Infinity)
  })
})
