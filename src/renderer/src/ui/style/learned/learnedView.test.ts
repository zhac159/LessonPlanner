import { describe, expect, it } from 'vitest'
import { aggregateAnalyses } from '@shared/style/votes'
import { makeAnalysis } from '@shared/style/testing'
import { sampleStyle } from '../galleryData'
import { BUILDING, fromLearned, fromProfile, fromProfileView, slideKindName } from './learnedView'

describe('fromProfile', () => {
  const data = fromProfile(sampleStyle)

  it('lists the colours with their token, label and usage', () => {
    expect(data.colours).toHaveLength(Object.keys(sampleStyle.tokens.colors).length)
    expect(data.colours?.find((c) => c.token === 'accent')).toMatchObject({
      hex: sampleStyle.tokens.colors.accent.hex,
      label: sampleStyle.tokens.colors.accent.label
    })
  })

  it('lists title then body fonts with their size ranges', () => {
    expect(data.fonts?.map((f) => f.use)).toEqual(['title', 'body'])
    expect(data.fonts?.[0]).toMatchObject({ family: 'Lexend', weight: 700, sizeRangePt: [40, 44] })
  })

  it('takes the habits, slide type names and voice rules from the profile', () => {
    expect(data.habits).toEqual(sampleStyle.habits)
    expect(data.slideTypes).toEqual(sampleStyle.slideTypes.map((t) => t.name))
    expect(data.voiceRules).toEqual(sampleStyle.voice.rules)
  })

  it('includes the accent font only when the profile has one, and nulls a missing size range', () => {
    const profile = structuredClone(sampleStyle)
    profile.tokens.fonts.accent = { ...profile.tokens.fonts.body, family: 'Caveat' }
    delete profile.tokens.fonts.body.sizeRangePt
    const fonts = fromProfile(profile).fonts
    expect(fonts?.map((f) => f.use)).toEqual(['title', 'body', 'accent'])
    expect(fonts?.[1].sizeRangePt).toBeNull()
  })
})

describe('fromProfileView', () => {
  it('shows skeletons when there is no profile yet', () => {
    expect(fromProfileView(null)).toBe(BUILDING)
    expect(Object.values(BUILDING).every((value) => value === null)).toBe(true)
  })

  it('passes the view fields through', () => {
    const data = fromProfile(sampleStyle)
    const view = {
      colours: data.colours ?? [],
      fonts: data.fonts ?? [],
      habits: data.habits ?? [],
      slideTypes: data.slideTypes ?? [],
      voiceRules: data.voiceRules ?? [],
      tokens: sampleStyle.tokens,
      components: sampleStyle.components,
      testSlide: null,
      version: 1
    }
    expect(fromProfileView(view)).toEqual(data)
  })
})

describe('fromLearned', () => {
  it('shows skeletons before any file is learned', () => {
    expect(fromLearned(aggregateAnalyses([]))).toBe(BUILDING)
  })

  it('names colours by role and carries hex values', () => {
    const data = fromLearned(aggregateAnalyses([makeAnalysis()]))
    expect(data.colours).toContainEqual({
      token: 'accent',
      hex: '#0E7C7B',
      label: 'Accent',
      usage: 'titles and accents'
    })
    expect(data.colours).toHaveLength(3)
  })

  it('fills fonts with weights, falling back to 400 and a plain stack', () => {
    const data = fromLearned(
      aggregateAnalyses([makeAnalysis({ fonts: [{ family: 'Lexend', usedFor: 'other' }] })])
    )
    expect(data.fonts).toEqual([
      {
        use: 'accent',
        family: 'Lexend',
        weight: 400,
        sizeRangePt: null,
        available: true,
        fallbackStack: "'Lexend', sans-serif"
      }
    ])
  })

  it('turns habits, slide kinds and voice rules into display text', () => {
    const data = fromLearned(aggregateAnalyses([makeAnalysis()]))
    expect(data.habits).toContain('Teal band on every slide')
    expect(data.slideTypes).toEqual(expect.arrayContaining(['Title', 'Content', 'Plenary']))
    expect(data.voiceRules).toEqual(['Objectives start with "Today I will…"'])
  })
})

describe('slideKindName', () => {
  it('uses the teacher-facing names', () => {
    expect(slideKindName('do-now')).toBe('Do Now')
    expect(slideKindName('objectives')).toBe('Learning objectives')
    expect(slideKindName('exit-ticket')).toBe('Exit ticket')
  })
})
