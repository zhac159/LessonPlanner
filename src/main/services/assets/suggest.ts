/**
 * "Suggested for this slide" (A11, A13): the library ranked against the slide's words and a picture spot's
 * description. Local and instant: names, titles, tags, kinds and descriptions are matched word by word; no Claude call.
 */
import type { Asset } from '@shared/assets/types'
import { KIND_WORDS } from './library'

const STOP = new Set(
  (
    'a an and are as at be by for from has have how in into is it its of on or our s that the their ' +
    'then there these they this to was we what when where which who why will with you your do now ' +
    'slide picture image spot here add put use'
  ).split(' ')
)

/** Lower-case words without plural endings, so "leaves" meets "leaf" and "cells" meets "cell". */
export function wordsOf(text: string): string[] {
  const out: string[] = []
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 2 || STOP.has(raw)) continue
    out.push(stem(raw))
  }
  return out
}

export function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ves')) return `${word.slice(0, -3)}f`
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 3 && word.endsWith('es') && /(s|x|ch|sh)es$/.test(word))
    return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

const matches = (haystack: ReadonlySet<string>, word: string): boolean => {
  if (haystack.has(word)) return true
  if (word.length < 4) return false
  for (const candidate of haystack) {
    if (candidate.length >= 4 && (candidate.startsWith(word) || word.startsWith(candidate)))
      return true
  }
  return false
}

export interface SuggestInput {
  /** Words of the slide's text. */
  text: string
  /** Words of the typed search or of the spot (counted double). */
  focus: string
}

/** Points for one asset: name and title words weigh most, then tags and kind words, then the description. */
export function scoreAsset(asset: Asset, input: SuggestInput): number {
  const parts = {
    name: new Set(wordsOf(`${asset.name.replace(/_/g, ' ')} ${asset.title}`)),
    tags: new Set(wordsOf(asset.tags.join(' '))),
    kind: new Set(KIND_WORDS[asset.kind].map(stem)),
    description: new Set(wordsOf(asset.description))
  }
  const weights = { name: 6, tags: 4, kind: 3, description: 1.5 } as const
  let score = 0
  for (const [text, factor] of [
    [input.text, 1],
    [input.focus, 2]
  ] as const) {
    for (const word of new Set(wordsOf(text))) {
      for (const part of ['name', 'tags', 'kind', 'description'] as const) {
        if (matches(parts[part], word)) score += weights[part] * factor
      }
    }
  }
  return score
}

/** Best first; assets that share no word with the slide are left out. Ties: used more, then newer. */
export function rankAssets(assets: readonly Asset[], input: SuggestInput, limit = 6): Asset[] {
  return assets
    .map((asset) => ({ asset, score: scoreAsset(asset, input) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.asset.usedIn.length - a.asset.usedIn.length ||
        b.asset.createdAt.localeCompare(a.asset.createdAt)
    )
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.asset)
}
