/**
 * `{{name}}` asset tokens in chat text. The composer keeps its message as plain text with tokens and draws
 * each token as a chip (picture + name); typing `{{` opens the picker. Messages are sent and stored as text
 * plus `ChatAssetRef`s, so a rename or a delete later never breaks an old message (agents/ASSETS.md §2.5).
 * Pure: no DOM.
 */
import type { ChatAssetRef } from './types'

/** Matches `{{ school_logo }}`; the name is looked up in lower case. */
const TOKEN_SOURCE = String.raw`\{\{\s*([A-Za-z0-9_]{1,64})\s*\}\}`

export type AssetTextSegment =
  { type: 'text'; text: string } | { type: 'asset'; name: string; raw: string }

/** The same text, with each token resolved (or not) against the library. */
export type ResolvedSegment =
  | { type: 'text'; text: string }
  | { type: 'chip'; assetId: string; name: string }
  | { type: 'missing'; name: string; raw: string }

export type AssetLookup = (name: string) => ChatAssetRef | undefined

export const formatAssetToken = (name: string): string => `{{${name}}}`

/** Splits text into plain text and tokens, in order. Text without tokens is one text segment. */
export function parseAssetTokens(text: string): AssetTextSegment[] {
  const segments: AssetTextSegment[] = []
  const re = new RegExp(TOKEN_SOURCE, 'g')
  let last = 0
  for (let match = re.exec(text); match; match = re.exec(text)) {
    if (match.index > last) segments.push({ type: 'text', text: text.slice(last, match.index) })
    segments.push({ type: 'asset', name: (match[1] ?? '').toLowerCase(), raw: match[0] })
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last) })
  return segments
}

/** The distinct names used in the text, in order of first use. */
export function assetTokenNames(text: string): string[] {
  const names: string[] = []
  for (const segment of parseAssetTokens(text)) {
    if (segment.type === 'asset' && !names.includes(segment.name)) names.push(segment.name)
  }
  return names
}

/** Tokens become chips when the library knows the name, otherwise `missing` (shown as plain text + a hint). */
export function resolveAssetTokens(text: string, lookup: AssetLookup): ResolvedSegment[] {
  return parseAssetTokens(text).map((segment): ResolvedSegment => {
    if (segment.type === 'text') return segment
    const found = lookup(segment.name)
    return found
      ? { type: 'chip', assetId: found.assetId, name: found.name }
      : { type: 'missing', name: segment.name, raw: segment.raw }
  })
}

/** Back to the text that is sent and stored: chips become `{{name}}`, unknown tokens stay as typed. */
export function segmentsToText(segments: readonly ResolvedSegment[]): string {
  return segments
    .map((segment) =>
      segment.type === 'text'
        ? segment.text
        : segment.type === 'chip'
          ? formatAssetToken(segment.name)
          : segment.raw
    )
    .join('')
}

/** The refs to send with a message: one per distinct known asset in the text. */
export function assetRefsInText(text: string, lookup: AssetLookup): ChatAssetRef[] {
  const refs = new Map<string, ChatAssetRef>()
  for (const segment of resolveAssetTokens(text, lookup)) {
    if (segment.type === 'chip' && !refs.has(segment.assetId)) {
      refs.set(segment.assetId, { assetId: segment.assetId, name: segment.name })
    }
  }
  return [...refs.values()]
}

/** Names in the text that the library does not know: the composer blocks Send and says which. */
export function unknownAssetNames(text: string, lookup: AssetLookup): string[] {
  const missing: string[] = []
  for (const segment of resolveAssetTokens(text, lookup)) {
    if (segment.type === 'missing' && !missing.includes(segment.name)) missing.push(segment.name)
  }
  return missing
}

/** The `{{` the caret is inside right now, e.g. `Put {{sch|` -> `{ start: 4, query: 'sch' }`; null when none. */
export function openAssetToken(
  text: string,
  caret: number
): { start: number; query: string } | null {
  const before = text.slice(0, caret)
  const match = /\{\{([A-Za-z0-9_]*)$/.exec(before)
  return match ? { start: match.index, query: match[1] ?? '' } : null
}

/** Replaces the open `{{query` with a finished token (and a space after it) once the picker returns a name. */
export function completeOpenToken(
  text: string,
  caret: number,
  name: string
): { text: string; caret: number } | null {
  const open = openAssetToken(text, caret)
  if (!open) return null
  const after = text.slice(caret).replace(/^\}\}/, '')
  const token = `${formatAssetToken(name)}${after.startsWith(' ') ? '' : ' '}`
  const next = text.slice(0, open.start) + token + after
  return { text: next, caret: open.start + formatAssetToken(name).length + 1 }
}

/** Inserts a token at the caret from the + menu, with a space either side where one is missing. */
export function insertAssetToken(
  text: string,
  caret: number,
  name: string
): { text: string; caret: number } {
  const before = text.slice(0, caret)
  const after = text.slice(caret)
  const lead = before.length === 0 || /\s$/.test(before) ? '' : ' '
  const trail = after.startsWith(' ') ? '' : ' '
  const token = formatAssetToken(name)
  return {
    text: `${before}${lead}${token}${trail}${after}`,
    caret: before.length + lead.length + token.length + trail.length
  }
}
