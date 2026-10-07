import { describe, expect, it } from 'vitest'
import { createDraftProfile } from './draft'
import { provisionalProfile, readableOn } from './provisional'
import { parseStyleProfile } from './schema'
import { makeAnalysis } from './testing'
import { aggregateAnalyses } from './votes'

const base = () => createDraftProfile('sty_1', 'Mine', '2026-10-06T10:00:00Z')

describe('provisionalProfile', () => {
  it('overlays learned colours, fonts and habits and stays a valid profile', () => {
    const learned = aggregateAnalyses([makeAnalysis()])
    const profile = provisionalProfile(base(), learned)
    expect(profile.tokens.colors.accent.hex).toBe('#0E7C7B')
    expect(profile.tokens.fonts.title).toMatchObject({ family: 'Lexend', weight: 700, sizePt: 40 })
    expect(profile.tokens.fonts.body.family).toBe('Lexend')
    expect(profile.habits).toEqual(['Teal band on every slide'])
    expect(profile.lessonFlow).toEqual(['title', 'content', 'plenary'])
    expect(() => parseStyleProfile(profile)).not.toThrow()
  })

  it('keeps identity, status and sources untouched', () => {
    const b = base()
    const profile = provisionalProfile(b, aggregateAnalyses([makeAnalysis()]))
    expect([profile.id, profile.name, profile.status, profile.sources]).toEqual([
      b.id,
      b.name,
      b.status,
      b.sources
    ])
  })

  it('keeps defaults when nothing has been learned', () => {
    const b = base()
    expect(provisionalProfile(b, aggregateAnalyses([])).tokens).toEqual(b.tokens)
  })

  it('makes chip text readable on the learned chip colour', () => {
    const learned = aggregateAnalyses([
      makeAnalysis({ colors: [{ hex: '#0B1F33', role: 'chip', evidence: '', frequency: 'most' }] })
    ])
    expect(provisionalProfile(base(), learned).tokens.colors.chipText.hex).toBe('#FFFFFF')
    expect(readableOn('#FFE36E')).toBe('#1F2937')
  })
})
