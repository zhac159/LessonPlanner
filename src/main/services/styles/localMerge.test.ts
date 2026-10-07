import { describe, expect, it } from 'vitest'
import { createDraftProfile } from '@shared/style/draft'
import { makeAnalysis } from '@shared/style/testing'
import { learnedSoFar, previewProfile, refreshLocalProfile } from './localMerge'
import { emptyMeta } from './metaSchema'
import type { StyleState } from './types'

function state(): StyleState {
  const profile = createDraftProfile('sty_1', 'My style', '2026-10-06T10:00:00Z')
  profile.isDefault = true
  profile.corrections = [{ text: 'c', at: 'x', appliedInVersion: 1 }]
  return { profile, meta: emptyMeta(), analyses: new Map() }
}

describe('local merge', () => {
  const learned = (s: StyleState, id: string) => {
    s.profile.sources.push({
      id,
      fileName: `${id}.pdf`,
      kind: 'pdf',
      pages: 1,
      status: 'learned',
      addedAt: 'x'
    })
    s.analyses.set(id, makeAnalysis())
  }

  it('turns the stored profile into the vote while nothing has been synthesised', () => {
    const s = state()
    learned(s, 'a')
    refreshLocalProfile(s)
    expect(s.profile.tokens.colors.accent.hex).toBe('#0E7C7B')
    expect(s.profile).toMatchObject({ id: 'sty_1', name: 'My style', isDefault: true, version: 1 })
    expect(s.profile.sources).toHaveLength(1)
    expect(s.profile.corrections).toHaveLength(1)
  })

  it('goes back to the neutral draft when no learned file is left', () => {
    const s = state()
    learned(s, 'a')
    refreshLocalProfile(s)
    s.analyses.clear()
    s.profile.sources = []
    refreshLocalProfile(s)
    expect(s.profile.tokens.colors.accent.hex).toBe('#2563EB')
    expect(s.profile.habits).toEqual([])
  })

  it('leaves a synthesised profile alone (preview only)', () => {
    const s = state()
    learned(s, 'a')
    s.meta.hasSynthesis = true
    refreshLocalProfile(s)
    expect(s.profile.tokens.colors.accent.hex).toBe('#2563EB')
    expect(previewProfile(s).tokens.colors.accent.hex).toBe('#0E7C7B')
  })

  it('only votes over learned files, in queue order', () => {
    const s = state()
    learned(s, 'a')
    s.profile.sources.push({
      id: 'b',
      fileName: 'b.pdf',
      kind: 'pdf',
      pages: 1,
      status: 'failed',
      addedAt: 'x'
    })
    s.analyses.set('b', makeAnalysis())
    expect(learnedSoFar(s).files).toBe(1)
  })
})
