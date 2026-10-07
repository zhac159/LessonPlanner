import { describe, expect, it } from 'vitest'
import { fail, ok } from '../result'
import { invalidChannels } from './channelPattern.test'
import {
  ASSETS,
  ASSETS_EVENTS,
  ASSETS_METHODS,
  type AssetPage,
  type AssetSummary,
  type AssetsApi,
  type MakeProgress,
  type OnlineQuery,
  type ReviewCandidate
} from './assets'

const summary = {
  id: 'ast_1',
  name: 'school_logo',
  title: 'School logo',
  kind: 'logo',
  tags: ['logo', 'title slides'],
  thumbDataUrl: null,
  width: 512,
  height: 560,
  sourceKind: 'extracted',
  licenceBadge: null,
  usedInCount: 14,
  foundInCount: 24,
  lastUsedAt: null,
  createdAt: '2026-10-07T09:00:00Z'
} satisfies AssetSummary

describe('assets contract', () => {
  it('serves the module id the bus routes on', () => {
    expect(ASSETS).toBe('assets')
  })

  it('uses valid, unique channel and event names', () => {
    expect(invalidChannels(ASSETS_METHODS)).toEqual([])
    expect(invalidChannels(ASSETS_EVENTS)).toEqual([])
  })

  it('keeps the area prefixes of the spec (add:, review:, online:, make:)', () => {
    const areas = ['add:', 'review:', 'online:', 'make:']
    for (const area of areas) expect(ASSETS_METHODS.some((m) => m.startsWith(area))).toBe(true)
    const plain = ASSETS_METHODS.filter((m) => !areas.some((a) => m.startsWith(a)))
    expect(plain.some((m) => m.includes(':'))).toBe(false)
  })

  it('describes the library page with the pending-review banner', () => {
    const page = {
      items: [summary],
      total: 1,
      libraryCount: 12,
      counts: {
        all: 12,
        logos: 1,
        icons: 6,
        pictures: 1,
        diagrams: 2,
        banners: 1,
        characters: 1,
        'symbol-cards': 0
      },
      froms: [{ key: 'anywhere', label: 'Anywhere', count: 12 }],
      cursor: null,
      pendingReview: { batchId: 'rev_1', found: 12, styleName: 'Science KS3' }
    } satisfies AssetPage
    expect(page.pendingReview.found).toBe(12)
  })

  it('describes a left-out candidate and a finished picture-maker job', () => {
    const candidate = {
      id: 'cand_1',
      batchId: 'rev_1',
      name: 'class_photo',
      title: 'Class photo',
      kind: 'photo',
      description: 'A group of pupils at desks',
      tags: [],
      thumbDataUrl: null,
      width: 800,
      height: 600,
      decks: 1,
      foundIn: [],
      keep: false,
      suggestedKeep: false,
      leftOut: { reason: 'pupils' }
    } satisfies ReviewCandidate
    const progress = {
      jobId: 'job_1',
      stage: 'done',
      versions: [1, 2, 3, 4].map((index) => ({
        index,
        state: 'ready' as const,
        thumbDataUrl: null
      })),
      styleDescription: 'Flat vector, navy outline'
    } satisfies MakeProgress
    expect(candidate.keep).toBe(false)
    expect(progress.versions).toHaveLength(4)
  })

  it('separates a cancelled dialog and a refused name from a success', () => {
    const results: ReturnType<AssetsApi['replaceFile']>[] = [
      ok({ cancelled: true as const }),
      ok({ asset: summary }),
      fail('not-found', 'That asset is not in your library.')
    ]
    expect(
      results.map((r) => (!r.ok ? r.code : 'cancelled' in r ? 'cancelled' : r.asset.name))
    ).toEqual(['cancelled', 'school_logo', 'not-found'])
    const refusal: ReturnType<AssetsApi['rename']> = fail(
      'invalid-input',
      'You already have an asset called owl_mascot.'
    )
    expect(refusal.ok).toBe(false)
  })

  it('defaults online search to free-to-use', () => {
    const query: OnlineQuery = { query: 'volcano diagram', kind: 'any', freeToUse: true, page: 1 }
    expect(query.freeToUse).toBe(true)
  })
})
