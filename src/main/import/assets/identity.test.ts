import { describe, expect, it } from 'vitest'
import { sameBitmap, samePlace, samePlaceAndLook } from './identity'

const look = (patch = {}) => ({
  hash: 'a'.repeat(64),
  width: 100,
  height: 80,
  perceptualHash: '0123456789abcdef',
  detailHash: 'f'.repeat(64),
  colorSignature: '80'.repeat(27),
  ...patch
})
const box = { x: 1600, y: 20, w: 200, h: 120 }

describe('identity', () => {
  it('treats identical bytes and practically identical re-saved copies as one bitmap', () => {
    expect(sameBitmap(look(), look())).toBe(true)
    expect(sameBitmap(look(), look({ hash: 'b'.repeat(64) }))).toBe(true)
    expect(sameBitmap(look(), look({ hash: 'b'.repeat(64), width: 101 }))).toBe(false)
    expect(
      sameBitmap(look(), look({ hash: 'b'.repeat(64), perceptualHash: 'fedcba9876543210' }))
    ).toBe(false)
    expect(
      sameBitmap(look(), look({ hash: 'b'.repeat(64), colorSignature: '10'.repeat(27) }))
    ).toBe(false)
    expect(
      sameBitmap(look({ perceptualHash: '' }), look({ hash: 'b'.repeat(64), perceptualHash: '' }))
    ).toBe(false)
  })

  it('compares positions with a 2% tolerance', () => {
    expect(samePlace(box, { ...box, x: box.x + 30 })).toBe(true)
    expect(samePlace(box, { ...box, x: box.x + 60 })).toBe(false)
    expect(samePlace(box, { ...box, h: box.h + 30 })).toBe(false)
  })

  it('needs both the position and a similar look for the repeated-element rule', () => {
    const a = { ...look(), box }
    const near = {
      ...look({ hash: 'c'.repeat(64), perceptualHash: '0123456789abcdee' }),
      box: { ...box, y: 25 }
    }
    expect(samePlaceAndLook(a, near)).toBe(true)
    expect(samePlaceAndLook(a, { ...near, box: { ...box, x: 100 } })).toBe(false)
    expect(samePlaceAndLook(a, { ...near, perceptualHash: 'fedcba9876543210' })).toBe(false)
    expect(samePlaceAndLook(a, { ...near, colorSignature: '00'.repeat(27) })).toBe(false)
    expect(samePlaceAndLook(a, { ...near, perceptualHash: '' })).toBe(false)
  })
})
