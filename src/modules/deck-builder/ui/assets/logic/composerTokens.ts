/** Pure helpers for `{{name}}` tokens in the Composer (agents/ASSETS.md §2.5), on top of `@shared/assets/tokens`. */
import {
  assetTokenNames,
  completeOpenToken,
  openAssetToken,
  type AssetLookup
} from '@shared/assets/tokens'
import { matchesAssetQuery, recentlyUsed } from '@shared/assets/library'
import type { ChatAssetRef } from '@shared/assets/types'
import type { AssetSummary } from '@shared/contracts/assets'

export interface TypedToken {
  /** Where the `{{` starts. */
  start: number
  /** The letters typed after it. */
  query: string
}

/** The `{{` the caret sits in, or null. Typing `{{sch` gives `{ start, query: 'sch' }`. */
export const typedTokenAt = (text: string, caret: number): TypedToken | null =>
  openAssetToken(text, caret)

/** Finishes the open token with `name` (and puts the caret after it); null when no token is open any more. */
export const finishTypedToken = (
  text: string,
  caret: number,
  name: string
): { text: string; caret: number } | null => completeOpenToken(text, caret, name)

/** Takes every `{{name}}` out of the text (the chip's ×), without leaving a double space behind. */
export function removeAssetToken(text: string, name: string): string {
  const escaped = name.replace(/[^A-Za-z0-9_]/g, '')
  const pattern = new RegExp(String.raw`[ \t]?\{\{\s*${escaped}\s*\}\}`, 'gi')
  return text.replace(pattern, '').replace(/^[ \t]+/, '')
}

/** Names the library does not know, for the "No asset called owl." line. */
export const unknownNames = (text: string, known: AssetLookup): string[] =>
  assetTokenNames(text).filter((name) => !known(name))

/** "No asset called owl." / "No asset called owl or sun." */
export function unknownNamesLine(names: readonly string[]): string {
  if (names.length === 0) return ''
  const joined =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
  return `No asset called ${joined}.`
}

export const refsOf = (chips: ReadonlyMap<string, ChatAssetRef>, text: string): ChatAssetRef[] => {
  const refs = new Map<string, ChatAssetRef>()
  for (const name of assetTokenNames(text)) {
    const ref = chips.get(name)
    if (ref && !refs.has(ref.assetId)) refs.set(ref.assetId, ref)
  }
  return [...refs.values()]
}

/** The first tile the picker shows for `query` (a recent one first, as the picker lists them): what Enter picks. */
export function firstMatch<
  T extends Pick<AssetSummary, 'name' | 'title' | 'kind' | 'tags' | 'lastUsedAt' | 'createdAt'>
>(assets: readonly T[], query: string): T | undefined {
  const keep = (asset: T): boolean => matchesAssetQuery({ ...asset, description: '' }, query)
  return recentlyUsed(assets).filter(keep)[0] ?? assets.find(keep)
}
