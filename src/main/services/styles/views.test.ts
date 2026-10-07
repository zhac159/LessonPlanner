import { describe, expect, it } from 'vitest'
import { createDraftProfile } from '@shared/style/draft'
import type { SourceRef } from '@shared/style/types'
import { emptyMeta } from './metaSchema'
import type { StyleState } from './types'
import { draftView, fileView, profileView, progressView, summaryView } from './views'

const source = (id: string, status: SourceRef['status'], pages = 0): SourceRef => ({
  id,
  fileName: `${id}.pdf`,
  kind: 'pdf',
  pages,
  status,
  addedAt: '2026-10-06T10:00:00Z'
})

function stateWith(...sources: SourceRef[]): StyleState {
  const profile = createDraftProfile('sty_1', 'Science', '2026-10-06T10:00:00Z')
  profile.sources = sources
  const meta = emptyMeta()
  for (const s of sources) {
    meta.files[s.id] = {
      fileName: s.fileName,
      kind: s.kind,
      addedAt: s.addedAt,
      hash: s.id,
      mayContainNames: false
    }
  }
  return { profile, meta, analyses: new Map() }
}

describe('fileView', () => {
  it('shows units only once counted and carries the error of a failed file', () => {
    const state = stateWith(source('a', 'waiting'), source('b', 'failed', 3))
    state.meta.files.b.error = { code: 'password', message: 'Password protected', retryable: false }
    state.meta.files.b.mayContainNames = true
    expect(fileView(state, state.profile.sources[0])).toEqual({
      id: 'a',
      name: 'a.pdf',
      kind: 'pdf',
      units: null,
      status: 'waiting',
      mayContainNames: false
    })
    expect(fileView(state, state.profile.sources[1])).toMatchObject({
      units: 3,
      status: 'failed',
      mayContainNames: true,
      error: { code: 'password', message: 'Password protected', retryable: false }
    })
  })

  it('hides a stale error on a file that is no longer failed', () => {
    const state = stateWith(source('a', 'waiting'))
    state.meta.files.a.error = { code: 'network', message: 'x', retryable: true }
    expect(fileView(state, state.profile.sources[0]).error).toBeUndefined()
  })
})

describe('progressView', () => {
  it('counts files and derives the stage when no job runs', () => {
    expect(progressView(stateWith()).stage).toBe('idle')
    expect(progressView(stateWith(source('a', 'waiting'))).stage).toBe('idle')
    const done = stateWith(source('a', 'learned'), source('b', 'failed'))
    expect(progressView(done)).toMatchObject({
      learned: 1,
      failed: 1,
      total: 2,
      stage: 'done',
      etaSeconds: null
    })
  })

  it('reports a paused queue with its reason', () => {
    const state = stateWith(source('a', 'waiting'))
    state.meta.pausedFor = 'no-key'
    expect(progressView(state)).toMatchObject({ stage: 'paused', pausedFor: 'no-key' })
  })

  it('takes stage and ETA from a running job', () => {
    const view = progressView(stateWith(source('a', 'reading')), {
      stage: 'reading',
      etaSeconds: 30
    })
    expect(view).toMatchObject({ stage: 'reading', etaSeconds: 30 })
  })
})

describe('profileView', () => {
  it('is null until a file is learned', () => {
    expect(profileView(stateWith(source('a', 'waiting')))).toBeNull()
  })

  it('projects tokens, fonts and rules for the panel (no sources or exemplars)', () => {
    const state = stateWith(source('a', 'learned'))
    state.profile.habits = ['Teal band']
    state.profile.voice.rules = ['No full stops']
    state.profile.slideTypes = [
      { kind: 'title', name: 'Title slide', frequency: 'always', description: '' }
    ]
    state.profile.tokens.fonts.title.sizeRangePt = [40, 44]
    const view = profileView(state)!
    expect(view).toMatchObject({
      habits: ['Teal band'],
      voiceRules: ['No full stops'],
      slideTypes: ['Title slide'],
      version: 1,
      testSlide: null
    })
    expect(view.colours.find((c) => c.token === 'accent')).toMatchObject({
      hex: '#2563EB',
      label: 'Blue'
    })
    expect(view.fonts.map((f) => [f.use, f.sizeRangePt])).toEqual([
      ['title', [40, 44]],
      ['body', null]
    ])
    expect(view).not.toHaveProperty('sources')
    expect(view).not.toHaveProperty('exemplars')
  })
})

describe('summaryView', () => {
  it('builds the Home card: swatch order, title font, deck count', () => {
    const state = stateWith(source('a', 'learned'), source('b', 'learned'))
    const summary = summaryView(state)
    expect(summary.swatches).toEqual(['#2563EB', '#1F2937', '#FFE36E', '#E0E7FF'])
    expect(summary).toMatchObject({
      id: 'sty_1',
      titleFont: 'Segoe UI',
      deckCount: 2,
      learning: null,
      primaryHex: '#2563EB',
      tintHex: '#E0E7FF'
    })
  })

  it('shows learning progress while files are pending', () => {
    const state = stateWith(source('a', 'learned'), source('b', 'reading'), source('c', 'waiting'))
    expect(summaryView(state).learning).toEqual({ learned: 1, total: 3 })
  })

  it('falls back sensibly when colour tokens are missing', () => {
    const state = stateWith()
    delete state.profile.tokens.colors.accent
    delete state.profile.tokens.colors.chipBg
    const summary = summaryView(state)
    expect(summary.swatches).toEqual(['#1F2937', '#FFE36E'])
    expect(summary.primaryHex).toBe(summary.tintHex)
  })
})

describe('draftView', () => {
  it('lists files in queue order and corrections without internals', () => {
    const state = stateWith(source('a', 'learned'), source('b', 'waiting'))
    state.profile.corrections = [
      { text: 'No yellow', at: '2026-10-06T11:00:00Z', appliedInVersion: 2 }
    ]
    state.meta.nameSource = 'user'
    const view = draftView(state)
    expect(view.files.map((f) => f.id)).toEqual(['a', 'b'])
    expect(view.corrections).toEqual([{ text: 'No yellow', at: '2026-10-06T11:00:00Z' }])
    expect(view).toMatchObject({
      id: 'sty_1',
      name: 'Science',
      nameSource: 'user',
      isDefault: false
    })
  })
})
