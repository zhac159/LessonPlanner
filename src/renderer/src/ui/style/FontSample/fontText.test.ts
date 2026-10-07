import { describe, expect, it } from 'vitest'
import { describeFontUse, fallbackFontName, fontWeightName, sampleFontFamily } from './fontText'

describe('fontWeightName', () => {
  it.each([
    [400, 'Regular'],
    [700, 'Bold'],
    [600, 'SemiBold'],
    [800, 'ExtraBold'],
    [450, '450']
  ])('%i is %s', (weight, name) => {
    expect(fontWeightName(weight)).toBe(name)
  })
})

describe('describeFontUse', () => {
  it('joins the use with the point range using an en dash', () => {
    expect(describeFontUse('title', [40, 44])).toBe('Titles · 40–44 pt')
    expect(describeFontUse('body', [20, 24])).toBe('Body text · 20–24 pt')
  })

  it('shows a single size when the range collapses', () => {
    expect(describeFontUse('body', [20, 20])).toBe('Body text · 20 pt')
  })

  it('shows only the use when the size is unknown', () => {
    expect(describeFontUse('accent', null)).toBe('Accents')
  })
})

describe('fallbackFontName', () => {
  it('names the first real font after the family', () => {
    expect(fallbackFontName('Lexend', "'Lexend', 'Segoe UI', sans-serif")).toBe('Segoe UI')
  })

  it('ignores the family case-insensitively and prefers a named font over a generic one', () => {
    expect(fallbackFontName('Lexend', 'lexend, sans-serif, Arial')).toBe('Arial')
  })

  it('falls back to the generic family, then to a plain phrase', () => {
    expect(fallbackFontName('Lexend', "'Lexend', sans-serif")).toBe('sans-serif')
    expect(fallbackFontName('Lexend', '')).toBe('a standard font')
    expect(fallbackFontName('Lexend', "'Lexend'")).toBe('a standard font')
  })
})

describe('sampleFontFamily', () => {
  it('uses the stack when there is one', () => {
    expect(sampleFontFamily('Lexend', "'Lexend', 'Segoe UI', sans-serif")).toBe(
      "'Lexend', 'Segoe UI', sans-serif"
    )
  })

  it('builds a stack from the family when the stack is blank', () => {
    expect(sampleFontFamily('Lexend', '  ')).toBe("'Lexend', sans-serif")
  })
})
