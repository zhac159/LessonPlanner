import { describe, expect, it } from 'vitest'
import {
  MAKE_VERSION_OPTIONS,
  aspectRatioFor,
  composeMakePrompt,
  looksLikeGoogleKey
} from './pictureMaker'

describe('looksLikeGoogleKey', () => {
  it('accepts the AIza shape and ignores pasted whitespace', () => {
    const key = `AIza${'a1B2-c3D4_'.repeat(4).slice(0, 35)}`
    expect(key).toHaveLength(39)
    expect(looksLikeGoogleKey(key)).toBe(true)
    expect(looksLikeGoogleKey(` ${key.slice(0, 20)} \n${key.slice(20)} `)).toBe(true)
  })
  it('rejects a Claude key, a short key and an empty string', () => {
    expect(looksLikeGoogleKey('sk-ant-api03-abcdefghijklmnopqrstuvwxyz')).toBe(false)
    expect(looksLikeGoogleKey('AIzaShort')).toBe(false)
    expect(looksLikeGoogleKey('')).toBe(false)
  })
})

describe('composeMakePrompt', () => {
  const style = 'Flat vector, 3 px navy outline, teal fills, no shadows.'
  it('states the subject, the style to match and the usability rules', () => {
    const prompt = composeMakePrompt({
      request: 'A Bunsen burner with a lit flame.',
      kind: 'icon',
      styleDescription: style
    })
    expect(prompt).toContain('simple icon')
    expect(prompt).toContain('A Bunsen burner with a lit flame:'.replace(':', '.'))
    expect(prompt).toContain(`Match this style exactly: ${style}`)
    expect(prompt).toMatch(/No text, letters, numbers or watermark/)
    expect(prompt).toMatch(/Plain white background/)
    expect(prompt).toMatch(/No real or recognisable people/)
  })
  it('asks for realism only for photos and skips an empty style line', () => {
    const photo = composeMakePrompt({ request: 'a leaf', kind: 'photo', styleDescription: '  ' })
    expect(photo).toContain('Natural lighting, realistic.')
    expect(photo).not.toContain('Match this style')
    expect(
      composeMakePrompt({ request: 'a leaf', kind: 'icon', styleDescription: style })
    ).not.toContain('Natural lighting')
  })
})

describe('picture maker facts', () => {
  it('chooses an aspect ratio per kind and offers 2 or 4 versions', () => {
    expect(aspectRatioFor('banner')).toBe('21:9')
    expect(aspectRatioFor('diagram')).toBe('4:3')
    expect(aspectRatioFor('icon')).toBe('1:1')
    expect(MAKE_VERSION_OPTIONS).toEqual([2, 4])
  })
})
