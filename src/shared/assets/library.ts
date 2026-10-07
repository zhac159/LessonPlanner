/**
 * Pure helpers for listing the library: the filter pills, search, sort and the counts (A1, A4, A8, A13).
 */
import type { Asset, AssetKind } from './types'

export type AssetFilterId =
  'all' | 'logos' | 'icons' | 'pictures' | 'diagrams' | 'banners' | 'characters' | 'symbol-cards'

export interface AssetFilter {
  id: AssetFilterId
  label: string
  kinds: readonly AssetKind[]
}

/** The pills, in order. "Pictures" holds photos too; "Symbol cards" is shown only when she has some. */
export const ASSET_FILTERS: readonly AssetFilter[] = [
  { id: 'all', label: 'All', kinds: [] },
  { id: 'logos', label: 'Logos', kinds: ['logo'] },
  { id: 'icons', label: 'Icons', kinds: ['icon'] },
  { id: 'pictures', label: 'Pictures', kinds: ['picture', 'photo'] },
  { id: 'diagrams', label: 'Diagrams', kinds: ['diagram'] },
  { id: 'banners', label: 'Banners', kinds: ['banner'] },
  { id: 'characters', label: 'Characters', kinds: ['character'] },
  { id: 'symbol-cards', label: 'Symbol cards', kinds: ['symbol-card'] }
]

export const filterById = (id: AssetFilterId): AssetFilter =>
  ASSET_FILTERS.find((filter) => filter.id === id) ?? ASSET_FILTERS[0]!

export const matchesFilter = (asset: Pick<Asset, 'kind'>, id: AssetFilterId): boolean =>
  id === 'all' || filterById(id).kinds.includes(asset.kind)

/** How many assets each pill holds (for "All · 12"). */
export function filterCounts(
  assets: readonly Pick<Asset, 'kind'>[]
): Record<AssetFilterId, number> {
  const counts = Object.fromEntries(ASSET_FILTERS.map((f) => [f.id, 0])) as Record<
    AssetFilterId,
    number
  >
  for (const asset of assets) {
    counts.all += 1
    for (const filter of ASSET_FILTERS) {
      if (filter.id !== 'all' && filter.kinds.includes(asset.kind)) counts[filter.id] += 1
    }
  }
  return counts
}

/** The pills to draw: all of them, except "Symbol cards" until she has some. */
export const visibleFilters = (counts: Record<AssetFilterId, number>): AssetFilter[] =>
  ASSET_FILTERS.filter((f) => f.id === 'all' || counts[f.id] > 0 || f.id !== 'symbol-cards')

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

/**
 * Search box: every typed word must start a word in the name, title, tags, kind or description
 * ("beak" finds beaker_icon, "title slides" finds the logo tagged "title slides"). Empty matches everything.
 */
export function matchesAssetQuery(
  asset: Pick<Asset, 'name' | 'title' | 'tags' | 'kind' | 'description'>,
  query: string
): boolean {
  const wanted = words(query)
  if (wanted.length === 0) return true
  const haystack = words(
    [asset.name, asset.title, asset.kind, asset.tags.join(' '), asset.description].join(' ')
  )
  return wanted.every((word) => haystack.some((candidate) => candidate.startsWith(word)))
}

/** Newest use first, then newest created: the "Recently used" row of the picker. */
export function recentlyUsed<T extends Pick<Asset, 'lastUsedAt' | 'createdAt'>>(
  assets: readonly T[],
  limit = 3
): T[] {
  return assets
    .filter((asset) => asset.lastUsedAt)
    .sort(
      (a, b) =>
        (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') ||
        b.createdAt.localeCompare(a.createdAt)
    )
    .slice(0, limit)
}

/** "14 lessons", "1 lesson", "Not used yet". */
export const lessonCountLabel = (count: number): string =>
  count === 0 ? 'Not used yet' : count === 1 ? '1 lesson' : `${count} lessons`
