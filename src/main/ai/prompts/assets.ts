/**
 * The teacher's assets as prompt text (agents/ASSETS.md §5.4): placement rules from her picture habits, then one
 * line per asset (`name · kind · title · description · tags`, most used first, at most 60). Deterministic: the same
 * library always gives the same bytes. Only this block changes when the library changes, so the cached head and
 * style-profile parts of the prompt keep hitting.
 */
import type { AssetCatalogue, AssetFact } from '@shared/ai/types'
import type { Asset, PictureHabits, PictureUse } from '@shared/assets/types'
import type { SlideKind } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'

export const MAX_CATALOGUE_LINES = 60
const DESCRIPTION_CUT = 120

/** `Asset` -> what the writer needs (no usage, sources or hashes). */
export const factOf = (asset: Asset): AssetFact => ({
  id: asset.id,
  name: asset.name,
  title: asset.title,
  kind: asset.kind,
  description: asset.description,
  tags: asset.tags,
  width: asset.file.width,
  height: asset.file.height,
  vector: asset.file.vector
})

/** The style's picture habits; absent on profiles learned before pictures were tracked. */
export const habitsOf = (profile: StyleProfile | null | undefined): PictureHabits | undefined =>
  profile?.pictures

const oneLine = (text: string, max: number): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`
}

/** Most used first, then most recently used, then by name (stable). */
export function mostUsedFirst(assets: readonly Asset[]): Asset[] {
  return [...assets].sort(
    (a, b) =>
      b.usedIn.length - a.usedIn.length ||
      (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') ||
      a.name.localeCompare(b.name)
  )
}

const kindWords = (kind: SlideKind | 'every'): string =>
  kind === 'every' ? 'every slide' : `${kind} slides`

const USE_WORDS: Record<PictureUse, string> = {
  always: 'always',
  usually: 'usually',
  sometimes: 'sometimes',
  never: 'never'
}

/** `school_logo: every slide, top-right, 240 units wide, 48 from the edge`, then her general picture habits. */
export function placementLines(
  habits: PictureHabits | undefined,
  byId: ReadonlyMap<string, Asset>
): string[] {
  if (!habits) return []
  const lines = habits.placements.flatMap((rule) => {
    const asset = byId.get(rule.assetId)
    return asset
      ? [
          `${asset.name}: ${kindWords(rule.slideKind)}, ${rule.anchor}, ${rule.widthUnits} units wide, ${rule.marginUnits} from the edge`
        ]
      : []
  })
  const use = habits.slideKinds.map((s) => `${s.kind} slides ${USE_WORDS[s.pictures]}`)
  if (use.length > 0) lines.push(`Picture use: ${use.join(', ')}`)
  return [...lines, ...habits.lines]
}

const libraryLine = (asset: Asset): string =>
  [
    asset.name,
    asset.kind,
    asset.title,
    oneLine(asset.description, DESCRIPTION_CUT),
    asset.tags.join(', ')
  ]
    .filter(Boolean)
    .join(' · ')

/**
 * The catalogue for a prompt. `find` knows the WHOLE library (so a name past the 60 shown still resolves); the text
 * shows the 60 most used and, beyond that, says how many more there are (chat can `list_assets({ query })`).
 */
export function buildAssetCatalogue(
  assets: readonly Asset[],
  habits?: PictureHabits,
  options: { canSearch?: boolean } = {}
): AssetCatalogue {
  const byName = new Map(assets.map((a) => [a.name.toLowerCase(), a]))
  const byId = new Map(assets.map((a) => [a.id, a]))
  const find = (name: string): AssetFact | undefined => {
    const asset = byName.get(
      name
        .trim()
        .replace(/^\{\{|\}\}$/g, '')
        .toLowerCase()
    )
    return asset ? factOf(asset) : undefined
  }
  if (assets.length === 0) return { text: '', find }

  const shown = mostUsedFirst(assets).slice(0, MAX_CATALOGUE_LINES)
  const rules = placementLines(habits, byId)
  const hidden = assets.length - shown.length
  const text = [
    "# The teacher's assets (her own reusable pictures)",
    'Names are exact: never invent one.',
    ...(rules.length ? ['Placement rules from her decks:', ...rules.map((r) => `- ${r}`)] : []),
    `Library (${assets.length}): name · kind · title · what it is · tags`,
    ...shown.map((a) => `- ${libraryLine(a)}`),
    ...(hidden > 0
      ? [
          options.canSearch
            ? `(${hidden} more: call list_assets with a query to find them.)`
            : `(${hidden} more are not shown.)`
        ]
      : [])
  ].join('\n')
  return { text, find }
}
