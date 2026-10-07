import { describe, expect, it } from 'vitest'
import { createDraftProfile } from '@shared/style/draft'
import { emptyMeta } from './metaSchema'
import { applySynthesis } from './synthesis'
import type { StyleState } from './types'

const NOW = '2026-10-06T12:00:00Z'
const slide = { id: 'sld_t', kind: 'content' as const, elements: [] }

function state(): StyleState {
  const profile = createDraftProfile('sty_1', 'My style', '2026-10-06T10:00:00Z')
  profile.isDefault = true
  profile.corrections = [{ text: 'c', at: 'x', appliedInVersion: 1 }]
  return { profile, meta: emptyMeta(), analyses: new Map() }
}

describe('applySynthesis', () => {
  it('keeps app-owned fields, bumps the version and stores the test slide', () => {
    const s = state()
    const incoming = {
      ...createDraftProfile('model-id', 'Science KS3', 'old'),
      habits: ['new'],
      isDefault: false
    }
    expect(applySynthesis(s, incoming, slide, NOW)).toEqual({ ok: true, name: 'Science KS3' })
    expect(s.profile).toMatchObject({
      id: 'sty_1',
      isDefault: true,
      version: 2,
      name: 'Science KS3',
      habits: ['new'],
      updatedAt: NOW,
      createdAt: '2026-10-06T10:00:00Z'
    })
    expect(s.profile.corrections).toHaveLength(1)
    expect(s.meta).toMatchObject({ synthesised: true, hasSynthesis: true, testSlide: slide })
  })

  it('does not rename a style the teacher named herself, and trims long suggestions', () => {
    const named = state()
    named.meta.nameSource = 'user'
    applySynthesis(named, createDraftProfile('x', 'Model name', 'x'), slide, NOW)
    expect(named.profile.name).toBe('My style')

    const auto = state()
    expect(
      applySynthesis(auto, createDraftProfile('x', 'N'.repeat(60), 'x'), slide, NOW)
    ).toMatchObject({
      ok: true,
      name: 'N'.repeat(40)
    })
    const same = state()
    expect(applySynthesis(same, createDraftProfile('x', 'My style', 'x'), slide, NOW)).toEqual({
      ok: true,
      name: null
    })
  })

  it('rejects an invalid profile and leaves the state untouched', () => {
    const s = state()
    const before = structuredClone(s.profile)
    const result = applySynthesis(s, { nonsense: 1 } as never, slide, NOW)
    expect(result.ok).toBe(false)
    expect(s.profile).toEqual(before)
    expect(s.meta.synthesised).toBe(false)
  })
})
