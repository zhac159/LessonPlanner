import { describe, expect, it } from 'vitest'
import {
  HASH_HEIGHT,
  HASH_WIDTH,
  differenceHash,
  grayFromPixels,
  hammingDistance,
  isBlurry,
  isNearDuplicate,
  isSimilar,
  laplacianVariance,
  luma
} from './hash'

const grid = (fn: (x: number, y: number) => number): number[] =>
  Array.from({ length: HASH_WIDTH * HASH_HEIGHT }, (_, i) =>
    fn(i % HASH_WIDTH, Math.floor(i / HASH_WIDTH))
  )

describe('differenceHash', () => {
  it('is 16 hex characters and is the same for the same picture', () => {
    const ramp = grid((x) => x * 20)
    expect(differenceHash(ramp)).toMatch(/^[0-9a-f]{16}$/)
    expect(differenceHash(ramp)).toBe(differenceHash([...ramp]))
  })

  it('turns a left-to-right ramp into all zeros and its mirror into all ones', () => {
    expect(differenceHash(grid((x) => x * 20))).toBe('0000000000000000')
    expect(differenceHash(grid((x) => 255 - x * 20))).toBe('ffffffffffffffff')
  })

  it('ignores a uniform brightness change and refuses too few values', () => {
    const base = grid((x, y) => (x * 17 + y * 5) % 90)
    expect(differenceHash(base.map((v) => v + 40))).toBe(differenceHash(base))
    expect(() => differenceHash([1, 2, 3])).toThrow()
  })
})

describe('hammingDistance and near duplicates', () => {
  it('counts differing bits', () => {
    expect(hammingDistance('0000000000000000', '0000000000000000')).toBe(0)
    expect(hammingDistance('0000000000000000', 'ffffffffffffffff')).toBe(64)
    expect(hammingDistance('0000000000000001', '0000000000000003')).toBe(1)
    expect(hammingDistance('abc', 'abc')).toBe(Infinity)
    expect(hammingDistance('zzzzzzzzzzzzzzzz', '0000000000000000')).toBe(Infinity)
  })

  it('separates the same picture, another version and something else', () => {
    const a = '0000000000000000'
    expect(isNearDuplicate(a, '000000000000003f')).toBe(true)
    expect(isNearDuplicate(a, '00000000000007ff')).toBe(false)
    expect(isSimilar(a, '00000000000007ff')).toBe(true)
    expect(isSimilar(a, 'ffffffffffffffff')).toBe(false)
  })
})

describe('grey values and blur', () => {
  it('uses luma weights and reads BGRA as well as RGBA', () => {
    expect(luma(255, 255, 255)).toBe(255)
    expect(luma(0, 0, 0)).toBe(0)
    expect(luma(255, 0, 0)).toBeLessThan(luma(0, 255, 0))
    expect(grayFromPixels([255, 0, 0, 255], 'rgba')[0]).toBe(luma(255, 0, 0))
    expect(grayFromPixels([255, 0, 0, 255], 'bgra')[0]).toBe(luma(0, 0, 255))
  })

  it('scores a flat picture as blurry and a sharp pattern as not', () => {
    const size = 16
    const flat = new Array(size * size).fill(128)
    const checker = Array.from({ length: size * size }, (_, i) =>
      ((i % size) + Math.floor(i / size)) % 2 ? 255 : 0
    )
    expect(isBlurry(laplacianVariance(flat, size, size))).toBe(true)
    expect(isBlurry(laplacianVariance(checker, size, size))).toBe(false)
    expect(laplacianVariance([1, 2], 2, 1)).toBe(0)
  })
})
