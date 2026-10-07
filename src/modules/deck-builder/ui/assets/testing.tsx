/** Test helpers for the editor's asset flows: a small library, fake `assets` and `settings` clients and a `placeAsset` that really applies ops. Not app code. */
import { vi } from 'vitest'
import { filterCounts } from '@shared/assets/library'
import { buildPlaceOps, resolvePlacement, type PlaceAssetArgs } from '@shared/assets/place'
import type { AssetKind } from '@shared/assets/types'
import {
  type AssetChip,
  type AssetPage,
  type AssetsApi,
  type AssetSummary,
  type MakeProgress,
  type OnlineResult
} from '@shared/contracts/assets'
import type { DeckBuilderApi, PlaceAssetResult } from '@shared/contracts/deck-builder'
import type { SettingsApi } from '@shared/contracts/settings'
import { fail, ok } from '@shared/result'
import { fakeClient } from '@test/render'
import type { FakeLesson } from '../editor/testing'

const PIXEL = 'data:image/png;base64,iVBORw0KGgo='

export function asset(name: string, over: Partial<AssetSummary> = {}): AssetSummary {
  return {
    id: `ast_${name}`,
    name,
    title: name.replace(/_/g, ' '),
    kind: 'icon' as AssetKind,
    tags: [],
    thumbDataUrl: PIXEL,
    width: 800,
    height: 600,
    sourceKind: 'uploaded',
    licenceBadge: null,
    usedInCount: 0,
    foundInCount: 0,
    lastUsedAt: null,
    createdAt: '2026-10-01T09:00:00.000Z',
    ...over
  }
}

/** The mockups' library: school_logo, owl_mascot, leaf_cross_section, leaf_icon, plant_cell_diagram… */
export const LIBRARY: AssetSummary[] = [
  asset('school_logo', {
    kind: 'logo',
    width: 400,
    height: 400,
    lastUsedAt: '2026-10-05T09:00:00.000Z'
  }),
  asset('owl_mascot', { kind: 'character', width: 500, height: 500 }),
  asset('leaf_cross_section', { kind: 'diagram', width: 1200, height: 800, tags: ['leaf'] }),
  asset('leaf_icon', { kind: 'icon', width: 512, height: 512, tags: ['leaf'] }),
  asset('plant_cell_diagram', { kind: 'diagram', width: 1000, height: 800 }),
  asset('beaker_icon', { kind: 'icon', width: 512, height: 512 })
]

export const chipOf = (a: AssetSummary): AssetChip => ({
  assetId: a.id,
  name: a.name,
  kind: a.kind,
  thumbDataUrl: a.thumbDataUrl,
  removed: false
})

export const pageOf = (items: AssetSummary[], libraryCount = items.length): AssetPage => ({
  items,
  total: items.length,
  libraryCount,
  counts: filterCounts(items),
  froms: [],
  cursor: null,
  pendingReview: null
})

export function onlineResult(n: number, over: Partial<OnlineResult> = {}): OnlineResult {
  return {
    id: `res_${n}`,
    title: `Leaf ${n}`,
    provider: 'openverse',
    providerLabel: 'Openverse',
    author: 'A. Photographer',
    licence: {
      id: n === 1 ? 'cc-by' : 'cc0',
      label: n === 1 ? 'CC BY' : 'CC0',
      requiresCredit: n === 1
    },
    pageUrl: `https://example.org/${n}`,
    width: 1600,
    height: 1200,
    thumbDataUrl: PIXEL,
    proposedName: n === 1 ? 'leaf_in_sunlight' : `leaf_${n}`,
    ...over
  }
}

/** A fake `assets` client over `library`; every answer can be replaced. */
export function fakeAssets(library: AssetSummary[] = LIBRARY, over: Partial<AssetsApi> = {}) {
  return fakeClient<AssetsApi>({
    list: () => pageOf(library),
    get: ({ assetId }) => {
      const found = library.find((a) => a.id === assetId)
      return found
        ? ok({ asset: { ...found, previewDataUrl: PIXEL } as never })
        : fail('not-found', 'That asset isn’t in your library any more.')
    },
    chips: ({ refs }) =>
      refs.map((ref) => {
        const found = library.find((a) => a.id === ref.assetId)
        return found
          ? chipOf(found)
          : { assetId: ref.assetId, name: ref.name, kind: null, thumbDataUrl: null, removed: true }
      }),
    resolveNames: ({ names }) =>
      names.flatMap((name) => {
        const found = library.find((a) => a.name === name.toLowerCase())
        return found ? [chipOf(found)] : []
      }),
    checkName: ({ name }) => ({ ok: true, name }),
    suggest: () =>
      ok({
        assets: library.filter((a) => a.tags.includes('leaf') || a.kind === 'diagram').slice(0, 3)
      }),
    'online:search': () =>
      ok({
        results: [1, 2, 3, 4, 5, 6].map((n) => onlineResult(n)),
        total: 6,
        page: 1,
        hasMore: false,
        providers: []
      }),
    'make:mode': () => ({
      mode: 'picture-maker',
      modelLabel: 'Nano Banana Pro',
      perPictureUsd: 0.13
    }),
    'make:start': () => ok({ jobId: 'job_make' }),
    'make:cancel': () => undefined,
    ...over
  })
}

export const makeProgress = (over: Partial<MakeProgress> = {}): MakeProgress => ({
  jobId: 'job_make',
  stage: 'done',
  versions: [1, 2].map((index) => ({ index, state: 'ready' as const, thumbDataUrl: PIXEL })),
  ...over
})

export function fakeSettings(uses = 0) {
  const prefs = { homeSort: 'edited', lastLengthMin: null, lastYearGroup: null, lastAbility: null }
  return fakeClient<SettingsApi>({
    getPreferences: () => ({ ...prefs, assetsMenuUses: uses }) as never,
    setPreferences: vi.fn() as never
  })
}

/**
 * A `placeAsset` for `FakeLesson`: resolves the placement and builds the ops exactly as main does, applies them as one
 * ChangeSet and answers with the chat message main would have stored.
 */
export function fakePlaceAsset(
  lesson: FakeLesson,
  library: AssetSummary[] = LIBRARY,
  onlineSaved: Record<string, AssetSummary> = {}
): DeckBuilderApi['placeAsset'] {
  return (args: PlaceAssetArgs) => {
    const slide = lesson.deck.slides.find((s) => s.id === args.slideId)
    if (!slide) return fail('not-found', 'That slide isn’t there any more.')
    const source = args.source
    const used =
      source.kind === 'library'
        ? library.find((a) => a.id === source.assetId)
        : (onlineSaved[source.kind === 'online' ? source.resultId : source.jobId] ??
          asset(source.name ?? 'new_picture', { width: 1600, height: 1200 }))
    if (!used) return fail('not-found', 'That asset isn’t in your library any more.')
    const placement = resolvePlacement(
      slide,
      { width: used.width, height: used.height },
      args.target,
      args.fit
    )
    if ('error' in placement) return fail('invalid-input', placement.error)
    const ops = buildPlaceOps({
      slide,
      placement,
      assetId: used.id,
      alt: used.title,
      name: used.name,
      newElementId: `el_${used.name}`,
      creditLine: source.kind === 'online' ? 'Picture credit: A. Photographer (CC BY)' : null
    })
    const applied = lesson.applyOps({
      ops,
      summary: placement.replaceElementId
        ? `Replaced the photo on slide with ${used.name}`
        : `Added ${used.name} to slide`
    })
    if (!applied.ok) return applied
    const { box } = placement
    const result: PlaceAssetResult = {
      changeSet: applied.changeSet,
      history: applied.history,
      elementId: placement.replaceElementId ?? `el_${used.name}`,
      placed: {
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        fit: box.fit,
        lowResolution: box.lowResolution
      },
      asset: used,
      chat: {
        id: 'm_placed',
        role: 'assistant',
        at: '2026-10-07T09:00:00.000Z',
        text: `Added {{${used.name}}} to slide.`,
        assets: [{ assetId: used.id, name: used.name }]
      }
    }
    return ok(result)
  }
}
