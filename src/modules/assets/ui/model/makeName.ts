import { ASSET_NAME_MAX, slugifyAssetName } from '@shared/assets/names'
import type { AssetKind } from '@shared/assets/types'

/** Words that end the "what" of a request: "a Bunsen burner *with* a lit flame". */
const STOPS = new Set(['with', 'in', 'on', 'of', 'for', 'that', 'which', 'showing', 'like', 'and'])
const ARTICLES = new Set(['a', 'an', 'the', 'some', 'my', 'simple', 'small', 'little'])
/** Kinds that read well as a suffix: `bunsen_burner_icon`. */
const SUFFIX: Partial<Record<AssetKind, string>> = {
  icon: 'icon',
  diagram: 'diagram',
  photo: 'photo',
  logo: 'logo',
  banner: 'banner',
  character: 'character'
}

/** The most common kind among the pictures she picked (ties go to the first seen); `picture` for none. */
export function commonKind(kinds: readonly AssetKind[]): AssetKind {
  const counts = new Map<AssetKind, number>()
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  let best: AssetKind = 'picture'
  let bestCount = 0
  for (const [kind, count] of counts) {
    if (count > bestCount) {
      best = kind
      bestCount = count
    }
  }
  return best
}

/**
 * A chat name from the request: "A Bunsen burner with a lit flame" + icons -> `bunsen_burner_icon`.
 * Always shaped like a valid name when the request has any letters; empty when it has none.
 */
export function suggestMakeName(prompt: string, kind: AssetKind): string {
  const words = prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  const subject: string[] = []
  for (const word of words) {
    if (STOPS.has(word) && subject.length > 0) break
    if (ARTICLES.has(word) || STOPS.has(word)) continue
    subject.push(word)
    if (subject.length === 3) break
  }
  if (subject.length === 0) return ''
  const suffix = SUFFIX[kind]
  const base = suffix && subject[subject.length - 1] !== suffix ? [...subject, suffix] : subject
  return slugifyAssetName(base.join(' '), ASSET_NAME_MAX)
}
