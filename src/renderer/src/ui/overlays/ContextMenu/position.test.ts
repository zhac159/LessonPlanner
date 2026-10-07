import { describe, expect, it } from 'vitest'
import { anchorBelow, clampToViewport } from './position'

const viewport = { width: 1000, height: 700 }
const size = { width: 200, height: 150 }

describe('clampToViewport', () => {
  it('leaves a menu that fits where it is', () => {
    expect(clampToViewport({ x: 100, y: 100 }, size, viewport)).toEqual({ x: 100, y: 100 })
  })

  it('pulls a menu back from the right and bottom edges', () => {
    expect(clampToViewport({ x: 950, y: 690 }, size, viewport)).toEqual({ x: 792, y: 542 })
  })

  it('keeps a margin from the top and left edges', () => {
    expect(clampToViewport({ x: -20, y: 2 }, size, viewport)).toEqual({ x: 8, y: 8 })
  })

  it('pins to the margin when the menu is larger than the viewport', () => {
    expect(clampToViewport({ x: 300, y: 300 }, { width: 2000, height: 2000 }, viewport)).toEqual({
      x: 8,
      y: 8
    })
  })

  it('honours a custom margin', () => {
    expect(clampToViewport({ x: 0, y: 0 }, size, viewport, 20)).toEqual({ x: 20, y: 20 })
  })
})

describe('anchorBelow', () => {
  it('returns the trigger’s bottom-left corner plus a gap', () => {
    const el = { getBoundingClientRect: () => ({ left: 40, bottom: 90 }) }
    expect(anchorBelow(el)).toEqual({ x: 40, y: 94 })
    expect(anchorBelow(el, 0)).toEqual({ x: 40, y: 90 })
  })
})
