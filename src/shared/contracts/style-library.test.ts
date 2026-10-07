import { describe, expect, it } from 'vitest'
import { fail, ok } from '../result'
import { invalidChannels } from './channelPattern.test'
import {
  STYLE_LIBRARY,
  STYLE_LIBRARY_EVENTS,
  STYLE_LIBRARY_METHODS,
  type LearnProgress,
  type StyleDraftView,
  type StyleFile,
  type StyleLibraryApi,
  type StyleSummary
} from './style-library'

describe('style-library contract', () => {
  it('serves the module id the bus routes on', () => {
    expect(STYLE_LIBRARY).toBe('style-library')
  })

  it('uses valid, unique channel and event names', () => {
    expect(invalidChannels(STYLE_LIBRARY_METHODS)).toEqual([])
    expect(invalidChannels(STYLE_LIBRARY_EVENTS)).toEqual([])
  })

  it('describes a Home card, a queue file and an empty draft', () => {
    const summary = {
      id: 'sty_1',
      name: 'Science KS3',
      isDefault: true,
      status: 'learning',
      swatches: ['#0E7C7B', '#12263A', '#FFE36E', '#E3F2F1'],
      titleFont: 'Lexend',
      deckCount: 2,
      learning: { learned: 2, total: 5 },
      primaryHex: '#0E7C7B',
      tintHex: '#E3F2F1',
      updatedAt: '2026-10-06T09:00:00Z'
    } satisfies StyleSummary
    const file = {
      id: 'f1',
      name: 'unit.pptx',
      kind: 'pptx',
      units: null,
      status: 'failed',
      error: { code: 'scanned', message: 'Scanned pages', retryable: false },
      mayContainNames: false
    } satisfies StyleFile
    const progress = {
      learned: 0,
      failed: 1,
      total: 1,
      stage: 'paused',
      pausedFor: 'no-credit',
      etaSeconds: null
    } satisfies LearnProgress
    const draft = {
      id: summary.id,
      name: summary.name,
      nameSource: 'auto',
      isDefault: false,
      status: 'draft',
      files: [file],
      progress,
      profile: null,
      corrections: []
    } satisfies StyleDraftView
    expect(draft.files[0]?.status).toBe('failed')
  })

  it('separates a cancelled dialog from a failure', () => {
    const results: ReturnType<StyleLibraryApi['pickAndCreateDraft']>[] = [
      ok({ cancelled: true as const }),
      ok({ styleId: 'sty_1', added: 1, rejected: [{ name: 'a.ppt', reason: 'old-ppt' }] }),
      fail('io', 'Could not copy the file')
    ]
    const labels = results.map((r) => (!r.ok ? r.code : 'cancelled' in r ? 'cancelled' : r.styleId))
    expect(labels).toEqual(['cancelled', 'sty_1', 'io'])
  })
})
