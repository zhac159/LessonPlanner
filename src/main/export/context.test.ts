import { describe, expect, it } from 'vitest'
import { hexOf, inchBox, noteFont, radiusInches, slideWarn, type SlideContext } from './context'
import { resolveFont } from './fonts'
import { loadFixtureStyle } from './testkit'

function fakeCtx(): { ctx: SlideContext; warnings: string[] } {
  const warnings: string[] = []
  const ctx = {
    style: loadFixtureStyle(),
    slideNumber: 4,
    io: {},
    warn: (m: string) => warnings.push(m)
  } as unknown as SlideContext
  return { ctx, warnings }
}

describe('hexOf', () => {
  it('resolves tokens through the profile', () => {
    expect(hexOf(fakeCtx().ctx, 'token:accent')).toBe('0E7C7B')
  })

  it('normalises hex: case, #, 3-digit shorthand and alpha', () => {
    const { ctx, warnings } = fakeCtx()
    expect(hexOf(ctx, '#abcdef')).toBe('ABCDEF')
    expect(hexOf(ctx, '#abc')).toBe('AABBCC')
    expect(hexOf(ctx, '#11223344')).toBe('112233')
    expect(warnings).toEqual([])
  })

  it('falls back to black with a warning for garbage', () => {
    const { ctx, warnings } = fakeCtx()
    expect(hexOf(ctx, '#nothex')).toBe('000000')
    expect(warnings).toEqual(['The colour “#nothex” was not valid, so black was used.'])
  })

  it('uses the default palette for tokens the profile lacks', () => {
    expect(hexOf({ ...fakeCtx().ctx, style: null }, 'token:highlight')).toBe('FFE36E')
  })
})

describe('geometry helpers', () => {
  it('converts a box from units to inches', () => {
    expect(inchBox({ x: 144, y: 288, w: 720, h: 36 })).toEqual({ x: 1, y: 2, w: 5, h: 0.25 })
  })

  it('caps the radius at half the short side and never goes negative', () => {
    const box = { x: 0, y: 0, w: 4, h: 3 }
    expect(radiusInches(144, box)).toBe(1)
    expect(radiusInches(9999, box)).toBe(1.5)
    expect(radiusInches(-5, box)).toBe(0)
  })
})

describe('messages', () => {
  it('prefixes slide warnings with the slide number', () => {
    const { ctx, warnings } = fakeCtx()
    slideWarn(ctx, 'oops')
    expect(warnings).toEqual(['Slide 4: oops'])
  })

  it('warns about unavailable fonts and passes available ones silently', () => {
    const { ctx, warnings } = fakeCtx()
    noteFont(ctx, resolveFont('body', ctx.style))
    expect(warnings).toEqual([])
    noteFont(ctx, { ...resolveFont('body', ctx.style), family: 'Zapfino', available: false })
    expect(warnings[0]).toContain('“Zapfino”')
  })
})
