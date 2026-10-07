/**
 * Pure helpers over the in-memory library: what a card and the detail pane show, the "From" select, and the
 * filtered, searched, sorted and paged list of A1 / A4 / A8 / A13 (agents/ASSETS.md §3.1). No disk, no Electron.
 */
import {
  ASSET_FILTERS,
  filterCounts,
  matchesAssetQuery,
  matchesFilter
} from '@shared/assets/library'
import type { AssetFilterId } from '@shared/assets/library'
import { leftOutSentence } from '@shared/assets/svgNotice'
import type { Asset, AssetKind } from '@shared/assets/types'
import type {
  AssetChip,
  AssetDetail,
  AssetFrom,
  AssetListQuery,
  AssetPage,
  AssetSummary
} from '@shared/contracts/assets'

export const DEFAULT_PAGE_SIZE = 60
export const MAX_PAGE_SIZE = 200
export const TITLE_MAX = 60
export const DESCRIPTION_MAX = 400
export const TAG_MAX = 12
export const TAG_LENGTH_MAX = 24

/** Lower-case, trimmed, no repeats, at most 12 tags of at most 24 characters. */
export function normaliseTags(tags: readonly string[]): string[] {
  const out: string[] = []
  for (const raw of tags) {
    const tag = raw.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, TAG_LENGTH_MAX).trim()
    if (tag && !out.includes(tag)) out.push(tag)
    if (out.length === TAG_MAX) break
  }
  return out
}

/** A title of 1 to 60 characters ("name" words when the text is empty). */
export function cleanTitle(title: string, fallback: string): string {
  const text = title.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX).trim()
  if (text) return text
  const words = fallback.replace(/_/g, ' ').trim()
  return (words.charAt(0).toUpperCase() + words.slice(1)).slice(0, TITLE_MAX) || 'Picture'
}

export const cleanDescription = (text: string): string =>
  text
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, DESCRIPTION_MAX)

/** "CC BY" for pictures that need a credit; nothing for her own pictures, CC0 and public domain. */
export const licenceBadgeOf = (asset: Pick<Asset, 'licence'>): string | null =>
  asset.licence.requiresCredit ? asset.licence.label : null

export function summaryOf(asset: Asset, thumbDataUrl: string | null): AssetSummary {
  return {
    id: asset.id,
    name: asset.name,
    title: asset.title,
    kind: asset.kind,
    tags: [...asset.tags],
    thumbDataUrl,
    width: asset.file.width,
    height: asset.file.height,
    sourceKind: asset.source.kind,
    licenceBadge: licenceBadgeOf(asset),
    usedInCount: asset.usedIn.length,
    foundInCount: asset.foundIn.length,
    lastUsedAt: asset.lastUsedAt,
    createdAt: asset.createdAt
  }
}

export function detailOf(
  asset: Asset,
  thumbDataUrl: string | null,
  previewDataUrl: string | null
): AssetDetail {
  return {
    ...summaryOf(asset, thumbDataUrl),
    description: asset.description,
    source: asset.source,
    licence: asset.licence,
    credit: asset.credit,
    foundIn: asset.foundIn.map((f) => ({ ...f })),
    bytes: asset.file.bytes,
    ...(asset.file.dropped?.length ? { leftOut: leftOutSentence(asset.file.dropped) } : {}),
    previewDataUrl
  }
}

export const chipOf = (asset: Asset, thumbDataUrl: string | null): AssetChip => ({
  assetId: asset.id,
  name: asset.name,
  kind: asset.kind,
  thumbDataUrl,
  removed: false
})

/** A chip for an asset that is gone: the name the message used, greyed. */
export const removedChip = (assetId: string, name: string): AssetChip => ({
  assetId,
  name,
  kind: null,
  thumbDataUrl: null,
  removed: true
})

// ---- the "From" select -------------------------------------------------------------------------

const foundByStyle = (asset: Asset, styleId: string): boolean =>
  (asset.source.kind === 'extracted' && asset.source.styleId === styleId) ||
  asset.foundIn.some((f) => f.styleId === styleId)

/** "Uploaded by me" also holds pictures she had cut out of a deck she uploaded on the Assets page. */
const uploadedByMe = (asset: Asset): boolean =>
  asset.source.kind === 'uploaded' ||
  (asset.source.kind === 'extracted' && asset.source.styleId === null)

export function matchesFrom(asset: Asset, from: AssetFrom): boolean {
  if (from === 'anywhere') return true
  if (from === 'uploaded') return uploadedByMe(asset)
  if (from === 'online') return asset.source.kind === 'online'
  if (from === 'made') return asset.source.kind === 'generated'
  return foundByStyle(asset, from.slice('style:'.length))
}

/** Anywhere, one entry per style that found pictures, then the kinds of source she has some of. */
export function buildFroms(
  assets: readonly Asset[],
  styleNames: ReadonlyMap<string, string>
): AssetPage['froms'] {
  const froms: AssetPage['froms'] = [{ key: 'anywhere', label: 'Anywhere', count: assets.length }]
  const styleIds = new Set<string>()
  for (const asset of assets) {
    if (asset.source.kind === 'extracted' && asset.source.styleId)
      styleIds.add(asset.source.styleId)
    for (const f of asset.foundIn) if (f.styleId) styleIds.add(f.styleId)
  }
  for (const id of styleIds) {
    const key: AssetFrom = `style:${id}`
    const count = assets.filter((a) => matchesFrom(a, key)).length
    if (count > 0) froms.push({ key, label: `${styleNames.get(id) ?? 'Your'} style`, count })
  }
  const kinds: Array<[AssetFrom, string]> = [
    ['uploaded', 'Uploaded by me'],
    ['online', 'Picked online'],
    ['made', 'Made with Claude']
  ]
  for (const [key, label] of kinds) {
    const count = assets.filter((a) => matchesFrom(a, key)).length
    if (count > 0) froms.push({ key, label, count })
  }
  return froms
}

// ---- the list ----------------------------------------------------------------------------------

type Sort = NonNullable<AssetListQuery['sort']>

const byName = (a: Asset, b: Asset): number =>
  a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }) || a.name.localeCompare(b.name)

const SORTS: Record<Sort, (a: Asset, b: Asset) => number> = {
  recent: (a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b),
  name: byName,
  'most-used': (a, b) => b.usedIn.length - a.usedIn.length || byName(a, b)
}

export interface LibraryQueryResult {
  page: Asset[]
  total: number
  counts: Record<AssetFilterId, number>
  froms: AssetPage['froms']
  cursor: string | null
}

const isFilterId = (value: unknown): value is AssetFilterId =>
  typeof value === 'string' && ASSET_FILTERS.some((f) => f.id === value)

/** Filters and From combine; the pill counts ignore the search (and the pill) so they never jump. */
export function queryLibrary(
  assets: readonly Asset[],
  query: AssetListQuery | undefined,
  styleNames: ReadonlyMap<string, string>
): LibraryQueryResult {
  const from = query?.from ?? 'anywhere'
  const filter = isFilterId(query?.filter) ? query.filter : 'all'
  const sort: Sort = query?.sort && query.sort in SORTS ? query.sort : 'recent'
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query?.limit ?? DEFAULT_PAGE_SIZE)))
  const offset = Math.max(0, Number.parseInt(query?.cursor ?? '0', 10) || 0)

  const inFrom = assets.filter((a) => matchesFrom(a, from))
  const matched = inFrom
    .filter((a) => matchesFilter(a, filter) && matchesAssetQuery(a, query?.search ?? ''))
    .sort(SORTS[sort])
  const next = offset + limit
  return {
    page: matched.slice(offset, next),
    total: matched.length,
    counts: filterCounts(inFrom),
    froms: buildFroms(assets, styleNames),
    cursor: next < matched.length ? String(next) : null
  }
}

/** The kinds a suggestion may mention, for ranking. */
export const KIND_WORDS: Readonly<Record<AssetKind, readonly string[]>> = {
  logo: ['logo', 'crest', 'badge'],
  icon: ['icon', 'symbol'],
  picture: ['picture', 'illustration', 'drawing', 'image'],
  photo: ['photo', 'photograph', 'picture', 'image'],
  diagram: ['diagram', 'chart', 'labelled'],
  banner: ['banner', 'heading'],
  character: ['character', 'mascot', 'cartoon'],
  'symbol-card': ['card', 'symbol', 'vocabulary']
}
