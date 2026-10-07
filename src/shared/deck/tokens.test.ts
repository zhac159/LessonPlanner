import { describe, expect, it } from 'vitest'
import { fixtureStyle } from './testing'
import { resolveTextStyle } from './textStyle'
import { DEFAULT_FONTS, DEFAULT_PALETTE, resolveColor, resolveFill, resolveFont } from './tokens'

describe('resolveColor', () => {
  const style = fixtureStyle()

  it('resolves tokens through the profile', () => {
    expect(resolveColor('token:accent', style)).toBe('#0E7C7B')
    expect(resolveColor('token:highlight', style)).toBe('#FFE36E')
  })

  it('falls back to the default palette when there is no profile', () => {
    expect(resolveColor('token:accent', null)).toBe(DEFAULT_PALETTE.accent)
    expect(resolveColor('token:background', null)).toBe('#FFFFFF')
  })

  it('falls back to the default palette for tokens the profile lacks', () => {
    expect(resolveColor('token:accent2', style)).toBe(DEFAULT_PALETTE.accent2)
  })

  it('falls back to the default text colour for unknown tokens', () => {
    expect(resolveColor('token:nonsense', style)).toBe(DEFAULT_PALETTE.text)
    expect(resolveColor('token:nonsense', null)).toBe(DEFAULT_PALETTE.text)
  })

  it('passes hex through and expands #RGB', () => {
    expect(resolveColor('#12AB34', style)).toBe('#12AB34')
    expect(resolveColor('#fa0', style)).toBe('#ffaa00')
  })
})

describe('resolveFont', () => {
  it('reads roles from the profile', () => {
    const style = fixtureStyle()
    expect(resolveFont('title', style)).toMatchObject({ family: 'Lexend', weight: 700 })
    expect(resolveFont('body', style)).toMatchObject({ family: 'Lexend', weight: 400 })
  })

  it('falls back to body when the profile has no accent font', () => {
    const style = fixtureStyle()
    expect(resolveFont('accent', style)).toBe(style.tokens.fonts.body)
  })

  it('uses the accent font when present', () => {
    const style = fixtureStyle()
    style.tokens.fonts.accent = { ...style.tokens.fonts.body, family: 'Poppins' }
    expect(resolveFont('accent', style).family).toBe('Poppins')
  })

  it('uses system fonts without a profile', () => {
    expect(resolveFont('title', null)).toBe(DEFAULT_FONTS.title)
    expect(resolveFont('body', null).available).toBe(true)
  })
})

describe('resolveTextStyle', () => {
  const style = fixtureStyle()

  it('uses the component named by styleRef', () => {
    const t = resolveTextStyle({ role: 'kicker', styleRef: 'kicker' }, style)
    expect(t).toMatchObject({
      sizePt: 13,
      color: '#0E7C7B',
      uppercase: true,
      letterSpacingEm: 0.12,
      weight: 700
    })
    expect(t.font.family).toBe('Lexend')
  })

  it('falls back to the component named like the role', () => {
    expect(resolveTextStyle({ role: 'heading' }, style)).toMatchObject({
      sizePt: 16,
      color: '#12263A',
      weight: 700
    })
  })

  it('lets the element override the size', () => {
    expect(
      resolveTextStyle({ role: 'title', styleRef: 'title', fontSizePt: 60 }, style).sizePt
    ).toBe(60)
    expect(resolveTextStyle({ role: 'title', styleRef: 'title' }, style).sizePt).toBe(40)
  })

  it('uses the font size of the profile for titles when no component defines one', () => {
    const bare = { ...style, components: {} }
    expect(resolveTextStyle({ role: 'title' }, bare).sizePt).toBe(bare.tokens.fonts.title.sizePt)
    expect(resolveTextStyle({ role: 'body' }, bare).sizePt).toBe(18)
  })

  it('has sensible defaults without any profile', () => {
    const body = resolveTextStyle({ role: 'body' }, null)
    expect(body).toMatchObject({
      sizePt: 18,
      color: DEFAULT_PALETTE.text,
      weight: 400,
      uppercase: false
    })
    expect(resolveTextStyle({ role: 'title' }, null)).toMatchObject({
      sizePt: 40,
      weight: 700,
      fontRole: 'title'
    })
    expect(resolveTextStyle({ role: 'caption' }, null).color).toBe(DEFAULT_PALETTE.muted)
  })
})

describe('resolveFill', () => {
  const style = fixtureStyle()

  it('returns the hex for opaque fills', () => {
    expect(resolveFill({ color: 'token:accent' }, style)).toBe('#0E7C7B')
    expect(resolveFill({ color: 'token:accent', opacity: 1 }, style)).toBe('#0E7C7B')
  })

  it('returns rgba() for partly transparent fills', () => {
    expect(resolveFill({ color: '#FFE36E', opacity: 0.5 }, style)).toBe('rgba(255, 227, 110, 0.5)')
    expect(resolveFill({ color: 'token:text', opacity: 0 }, style)).toBe('rgba(18, 38, 58, 0)')
  })

  it('works for short hex and without a profile', () => {
    expect(resolveFill({ color: '#fff', opacity: 0.25 }, null)).toBe('rgba(255, 255, 255, 0.25)')
  })
})
