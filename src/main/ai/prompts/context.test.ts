import { describe, expect, it } from 'vitest'
import { fixtureProfile } from '../fake/fixtures'
import { DECK_MODEL } from './deckModel'
import {
  NO_PROFILE_TEXT,
  briefText,
  buildSystem,
  planText,
  profileForPrompt,
  profileText
} from './context'

describe('profile text', () => {
  it('leaves out volatile bookkeeping so the cache prefix stays stable', () => {
    const profile = fixtureProfile()
    const rendered = profileText(profile)
    expect(rendered).not.toContain(profile.id)
    expect(rendered).not.toContain(profile.createdAt)
    expect(Object.keys(profileForPrompt(profile) as object)).not.toContain('sources')
    expect(rendered).toContain('"layouts"')
  })

  it('is byte-identical for the same profile whatever the key order', () => {
    const a = fixtureProfile()
    const b = { ...a, tokens: { fonts: a.tokens.fonts, colors: a.tokens.colors } }
    expect(profileText(b)).toBe(profileText(a))
  })

  it('does not change when only version or dates change', () => {
    const a = fixtureProfile()
    expect(profileText({ ...a, version: 99, updatedAt: 'later' })).toBe(profileText(a))
  })

  it('says so when there is no profile', () => {
    expect(profileText(null)).toContain(NO_PROFILE_TEXT)
  })
})

describe('buildSystem', () => {
  it('puts [A]+[B] first and [C] second, each a cache breakpoint', () => {
    const system = buildSystem({
      instructions: ['A text'],
      deckModel: true,
      profile: fixtureProfile()
    })
    expect(system).toHaveLength(2)
    expect(system[0].text).toContain('A text')
    expect(system[0].text).toContain(DECK_MODEL)
    expect(system[0].cache).toBe(true)
    expect(system[1].text).toContain('Style profile')
    expect(system[1].cache).toBe(true)
  })

  it('omits [B] and [C] when not asked for', () => {
    const system = buildSystem({ instructions: ['only A'] })
    expect(system).toEqual([{ text: 'only A', cache: true }])
  })

  it('adds the "no profile" block for null', () => {
    expect(buildSystem({ instructions: ['A'], profile: null })[1].text).toContain(NO_PROFILE_TEXT)
  })

  it('contains no per-call data (timestamps, random ids)', () => {
    const first = buildSystem({ instructions: ['A'], deckModel: true, profile: fixtureProfile() })
    const second = buildSystem({ instructions: ['A'], deckModel: true, profile: fixtureProfile() })
    expect(second).toEqual(first)
  })
})

describe('lesson text', () => {
  it('lists the objectives with 0-based indexes and only the fields that are set', () => {
    const text = briefText({
      title: 'Photosynthesis',
      yearGroup: 'Y8',
      objectives: ['Describe it', 'Write the equation']
    })
    expect(text).toContain('0. Describe it')
    expect(text).toContain('1. Write the equation')
    expect(text).toContain('Year group: Y8')
    expect(text).not.toContain('Subject:')
    expect(text).not.toContain('Duration')
  })

  it('renders the plan as stable JSON', () => {
    const plan = { title: 'T', summary: 's', slides: [] }
    expect(planText(plan)).toBe(
      '# Lesson plan (all slides)\n{"slides":[],"summary":"s","title":"T"}'
    )
  })
})
