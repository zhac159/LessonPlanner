/** Test-only factories and fake clients for the Assets page (component tests). */
import type { ContractImpl } from '@shared/contract'
import type { AssetFilterId } from '@shared/assets/library'
import { ASSET_FILTERS } from '@shared/assets/library'
import type { AssetKind } from '@shared/assets/types'
import type {
  AssetDetail,
  AssetPage,
  AssetSummary,
  OnlineResult,
  ReviewBatch,
  ReviewCandidate,
  ReviewView
} from '@shared/contracts/assets'
import { ok } from '@shared/result'
import { fakeClient } from '@test/fakeClients'
import type { AssetsFullApi } from '../shared'

export const PIC =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'

export function makeSummary(name: string, over: Partial<AssetSummary> = {}): AssetSummary {
  return {
    id: `id-${name}`,
    name,
    title: name
      .split('_')
      .map((w, i) => (i === 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
      .join(' '),
    kind: 'icon',
    tags: [],
    thumbDataUrl: PIC,
    width: 256,
    height: 256,
    sourceKind: 'extracted',
    licenceBadge: null,
    usedInCount: 0,
    foundInCount: 1,
    lastUsedAt: null,
    createdAt: '2026-03-01T00:00:00Z',
    ...over
  }
}

export const SAMPLE: AssetSummary[] = [
  makeSummary('school_logo', { kind: 'logo', usedInCount: 14, title: 'School logo' }),
  makeSummary('do_now_banner', { kind: 'banner', usedInCount: 18, title: 'Do Now banner' }),
  makeSummary('beaker_icon', { usedInCount: 0, title: 'Beaker' }),
  makeSummary('microscope_icon', { usedInCount: 6, title: 'Microscope' }),
  makeSummary('timer_icon', { usedInCount: 12, title: '5-minute timer' })
]

export function makeDetail(base: AssetSummary, over: Partial<AssetDetail> = {}): AssetDetail {
  return {
    ...base,
    description: `A picture called ${base.name}.`,
    source: {
      kind: 'extracted',
      styleId: null,
      fileName: 'Y8 Photosynthesis.pptx',
      page: 1,
      at: '2026-03-01T00:00:00Z'
    },
    licence: { id: 'unknown', label: 'From your files', requiresCredit: false },
    credit: null,
    foundIn: [{ styleId: null, sourceId: 's1', fileName: 'Y8 Photosynthesis.pptx', page: 1 }],
    bytes: 1000,
    previewDataUrl: PIC,
    ...over
  }
}

export function countsOf(items: readonly AssetSummary[]): AssetPage['counts'] {
  const counts = Object.fromEntries(ASSET_FILTERS.map((f) => [f.id, 0])) as Record<
    AssetFilterId,
    number
  >
  for (const item of items) {
    counts.all += 1
    for (const f of ASSET_FILTERS) if (f.kinds.includes(item.kind as AssetKind)) counts[f.id] += 1
  }
  return counts
}

export function makePage(items: AssetSummary[] = SAMPLE, over: Partial<AssetPage> = {}): AssetPage {
  return {
    items,
    total: items.length,
    libraryCount: items.length,
    counts: countsOf(items),
    froms: [
      { key: 'anywhere', label: 'Anywhere', count: items.length },
      { key: 'uploaded', label: 'Uploaded by me', count: 1 }
    ],
    cursor: null,
    pendingReview: null,
    ...over
  }
}

export function makeCandidate(name: string, over: Partial<ReviewCandidate> = {}): ReviewCandidate {
  return {
    id: `c-${name}`,
    batchId: 'b1',
    name,
    title: name,
    kind: 'icon',
    description: '',
    tags: [],
    thumbDataUrl: PIC,
    width: 100,
    height: 100,
    decks: 6,
    foundIn: [],
    keep: true,
    suggestedKeep: true,
    leftOut: null,
    ...over
  }
}

export const BATCH: ReviewBatch = {
  id: 'b1',
  origin: { kind: 'style', styleId: 's1', styleName: 'Science KS3' },
  startedAt: '2026-03-01T00:00:00Z',
  working: false,
  files: [
    {
      id: 'f1',
      name: 'Y8 Photosynthesis.pptx',
      kind: 'pptx',
      found: 4,
      state: 'done',
      progress: null
    },
    { id: 'f2', name: 'Y7 Cells.pdf', kind: 'pdf', found: 3, state: 'done', progress: null }
  ]
}

export function makeReview(over: Partial<ReviewView> = {}): ReviewView {
  const candidates = over.candidates ?? [
    makeCandidate('school_logo', { kind: 'logo' }),
    makeCandidate('owl_mascot', { kind: 'character' }),
    makeCandidate('class_photo', {
      kind: 'picture',
      keep: false,
      suggestedKeep: false,
      leftOut: { reason: 'pupils' }
    })
  ]
  const keeping = candidates.filter((c) => c.keep).length
  return {
    batches: [BATCH],
    candidates,
    found: candidates.length,
    keeping,
    leftOut: candidates.length - keeping,
    stillReading: 0,
    ...over
  }
}

export function makeResult(title: string, over: Partial<OnlineResult> = {}): OnlineResult {
  return {
    id: `r-${title}`,
    title,
    provider: 'wikimedia',
    providerLabel: 'Wikimedia Commons',
    author: 'A. Author',
    licence: { id: 'cc-by-sa', label: 'CC BY-SA 4.0', requiresCredit: true },
    pageUrl: 'https://commons.example/volcano',
    width: 1600,
    height: 1200,
    thumbDataUrl: PIC,
    proposedName: title.toLowerCase().replace(/\W+/g, '_'),
    ...over
  }
}

/** A fake assets client that answers like a small library; override per test. */
export function fakeAssets(overrides: Partial<ContractImpl<AssetsFullApi>> = {}) {
  const items = SAMPLE
  return fakeClient<AssetsFullApi>({
    list: () => makePage(items),
    get: ({ assetId }) => {
      const found = items.find((a) => a.id === assetId) ?? items[0]!
      return ok({ asset: makeDetail(found) })
    },
    checkName: ({ name }) => ({ ok: true as const, name }),
    rename: ({ name }) => ok({ asset: makeSummary(name) }),
    update: () => ok({ asset: items[0]! }),
    remove: () => ok(),
    restore: () => ok(),
    replaceFile: () => ok({ cancelled: true as const }),
    usage: () => ok({ usage: { lessons: [], foundIn: [] } }),
    'library:tidied': () => null,
    'review:get': () => makeReview({ batches: [], candidates: [] }),
    'make:mode': () => ({ mode: 'vector' as const, modelLabel: null, perPictureUsd: null }),
    'make:cancel': () => undefined,
    ...overrides
  })
}
