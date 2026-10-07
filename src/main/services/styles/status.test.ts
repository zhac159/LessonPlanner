import { describe, expect, it } from 'vitest'
import { createDraftProfile } from '@shared/style/draft'
import { emptyMeta } from './metaSchema'
import { deriveStatus } from './status'
import type { StyleState } from './types'

function state(): StyleState {
  const profile = createDraftProfile('sty_1', 'My style', '2026-10-06T10:00:00Z')
  profile.isDefault = true
  profile.corrections = [{ text: 'c', at: 'x', appliedInVersion: 1 }]
  return { profile, meta: emptyMeta(), analyses: new Map() }
}

describe('deriveStatus', () => {
  const src = (status: 'learned' | 'waiting' | 'failed') => ({
    id: status,
    fileName: 'f',
    kind: 'pdf' as const,
    pages: 0,
    status,
    addedAt: 'x'
  })

  it('is draft until saved', () => {
    const s = state()
    s.profile.sources = [src('learned')]
    expect(deriveStatus(s, false)).toBe('draft')
  })

  it('is learning while pending or a job runs, then ready, or failed when nothing was read', () => {
    const s = state()
    s.meta.saved = true
    s.profile.sources = [src('learned'), src('waiting')]
    expect(deriveStatus(s, false)).toBe('learning')
    s.profile.sources = [src('learned')]
    expect(deriveStatus(s, true)).toBe('learning')
    expect(deriveStatus(s, false)).toBe('ready')
    s.profile.sources = [src('failed')]
    expect(deriveStatus(s, false)).toBe('failed')
    s.profile.sources = []
    expect(deriveStatus(s, false)).toBe('draft')
  })
})
