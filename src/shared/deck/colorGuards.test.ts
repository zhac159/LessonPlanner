import { describe, expect, it } from 'vitest'
import { fixtureStyle } from './testing'
import {
  NEUTRAL_PLACEHOLDER,
  contrastRatio,
  isNeutralTint,
  readableOn,
  safePlaceholder
} from './colorGuards'
import { stripUnresolvedDates } from './dates'
import { resolveColor } from './tokens'
import { resolveTextStyle } from './textStyle'
import type { StyleProfile } from '../style/types'

const withTokens = (colors: Record<string, string>): StyleProfile => {
  const style = fixtureStyle()
  for (const [name, hex] of Object.entries(colors)) {
    style.tokens.colors[name] = { hex, label: name, usage: '' }
  }
  return style
}

describe('placeholder token guard', () => {
  it('keeps a quiet light tint and replaces a one-off colour with neutral grey', () => {
    expect(isNeutralTint('#EBEBEE')).toBe(true)
    expect(isNeutralTint('#FFB800')).toBe(false)
    expect(isNeutralTint('#222222')).toBe(false)
    expect(safePlaceholder('#FFB800')).toBe(NEUTRAL_PLACEHOLDER)
    expect(safePlaceholder(undefined)).toBe(NEUTRAL_PLACEHOLDER)
  })

  it('resolveColor never leaks the orange from her profile', () => {
    expect(resolveColor('token:placeholder', withTokens({ placeholder: '#FFB800' }))).toBe(
      NEUTRAL_PLACEHOLDER
    )
    expect(resolveColor('token:placeholder', withTokens({ placeholder: '#EBEBEE' }))).toBe(
      '#EBEBEE'
    )
    expect(resolveColor('token:placeholder', null)).toBe(NEUTRAL_PLACEHOLDER)
    // a literal hex a slide asks for is its own business
    expect(resolveColor('#FFB800', null)).toBe('#FFB800')
  })
})

describe('readableOn', () => {
  it('returns the preferred colour when it reads, else black or white', () => {
    expect(readableOn('#FFFFFF', ['#000000'])).toBe('#000000')
    expect(readableOn('#FFFFFF', ['#FFFFFF'])).toBe('#000000')
    expect(readableOn('#000000', ['#111111'])).toBe('#FFFFFF')
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
  })
})

describe('kicker case', () => {
  it('keeps her case when the profile has a kicker component without `uppercase`', () => {
    const style = withTokens({})
    style.components.kicker = { description: 'k', bold: true }
    const resolved = resolveTextStyle({ role: 'kicker' }, style)
    expect(resolved.uppercase).toBe(false)
    expect(resolved.letterSpacingEm).toBe(0)
  })

  it('honours `uppercase: true` and still defaults to capitals without a profile component', () => {
    const style = withTokens({})
    style.components.kicker = { description: 'k', uppercase: true, letterSpacingEm: 0.1 }
    expect(resolveTextStyle({ role: 'kicker' }, style).uppercase).toBe(true)
    delete style.components.kicker
    expect(resolveTextStyle({ role: 'kicker' }, style).uppercase).toBe(true)
    expect(resolveTextStyle({ role: 'kicker' }, null).uppercase).toBe(true)
  })
})

describe('stripUnresolvedDates', () => {
  it('removes empty date fields and leaves typed dates alone', () => {
    expect(stripUnresolvedDates('Monday {{date}}')).toBe('Monday')
    expect(stripUnresolvedDates('[Date] LO: To infer')).toBe('LO: To infer')
    expect(stripUnresolvedDates('Due DD/MM/YYYY please')).toBe('Due please')
    expect(stripUnresolvedDates('Monday 5th October 2026')).toBe('Monday 5th October 2026')
    expect(stripUnresolvedDates('')).toBe('')
  })
})
