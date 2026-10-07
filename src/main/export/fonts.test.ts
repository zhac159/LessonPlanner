import { describe, expect, it } from 'vitest'
import { resolveFont } from './fonts'
import { loadFixtureStyle } from './testkit'

const style = loadFixtureStyle()

describe('resolveFont', () => {
  it('uses the title component: title font, bold, navy text', () => {
    expect(resolveFont('title', style, 'title')).toMatchObject({
      family: 'Lexend',
      sizePt: 40,
      bold: true,
      color: 'token:text',
      uppercase: false,
      available: true
    })
  })

  it('takes size, colour, case and spacing from the kicker component', () => {
    const kicker = resolveFont('kicker', style, 'kicker')
    expect(kicker).toMatchObject({ sizePt: 13, bold: true, color: 'token:accent', uppercase: true })
    expect(kicker.letterSpacingPt).toBeCloseTo(1.56, 2)
  })

  it('does not bold plain body text', () => {
    expect(resolveFont('body', style, 'body')).toMatchObject({ sizePt: 18, bold: false })
  })

  it('falls back to role defaults when the style ref is unknown or missing', () => {
    expect(resolveFont('heading', style)).toMatchObject({
      family: 'Lexend',
      bold: true,
      sizePt: 24
    })
    expect(resolveFont('caption', style, 'does-not-exist')).toMatchObject({
      color: 'token:muted',
      sizePt: 14
    })
  })

  it('treats an unknown role like body', () => {
    expect(resolveFont('mystery', style).color).toBe('token:text')
  })

  it('uses Calibri when there is no profile', () => {
    expect(resolveFont('body', null)).toMatchObject({
      family: 'Calibri',
      sizePt: 20,
      available: true
    })
    expect(resolveFont('title', null)).toMatchObject({ family: 'Calibri', bold: true, sizePt: 40 })
  })

  it('reports fonts the profile says are not available', () => {
    const other = structuredClone(style)
    other.tokens.fonts.body.available = false
    expect(resolveFont('body', other).available).toBe(false)
  })

  it('uses the accent font when a component asks for it and the profile has one', () => {
    const other = structuredClone(style)
    other.tokens.fonts.accent = { ...other.tokens.fonts.body, family: 'Poppins' }
    other.components.fancy = { description: 'x', font: 'accent' }
    expect(resolveFont('body', other, 'fancy').family).toBe('Poppins')
    expect(resolveFont('body', style, 'fancy').family).toBe('Lexend')
  })
})
