/**
 * `{{name}}` tokens in chat (agents/ASSETS.md §2.5). Her message: names are pinned to ids by the refs she sends, so a
 * rename between typing and sending is harmless and a deleted asset is named in plain words. Claude's reply: each
 * token is checked against the library BEFORE it is streamed; an unknown one becomes the bare word, so no dead chip
 * ever appears. Pure.
 */
import { assetTokenNames, parseAssetTokens } from '@shared/assets/tokens'
import type { Asset, ChatAssetRef } from '@shared/assets/types'
import { fail, ok, type Result } from '@shared/result'

/** The library as these helpers need it. */
export interface TokenLibrary {
  get(assetId: string): Pick<Asset, 'id' | 'name'> | undefined
  byName(name: string): Pick<Asset, 'id' | 'name'> | undefined
}

/** A `TokenLibrary` over a list of assets (the port's `list()`), names matched in lower case. */
export function libraryOf(assets: () => readonly Pick<Asset, 'id' | 'name'>[]): TokenLibrary {
  return {
    get: (id) => assets().find((a) => a.id === id),
    byName: (name) => assets().find((a) => a.name.toLowerCase() === name.toLowerCase())
  }
}

const isRef = (value: unknown): value is ChatAssetRef =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ChatAssetRef).assetId === 'string' &&
  typeof (value as ChatAssetRef).name === 'string'

export const gone = (name: string): string => `${name} isn’t in your library any more.`

/**
 * Her message with its tokens resolved: `text` has every token rewritten to the asset's CURRENT name and `refs` has
 * one entry per distinct asset. A name with no matching ref is looked up in the library; an id that is gone fails
 * with "{name} isn't in your library any more.", a name nobody knows with "No asset called {name}."
 */
export function resolveMessageAssets(
  text: string,
  refs: readonly unknown[] | undefined,
  library: TokenLibrary
): Result<{ text: string; refs: ChatAssetRef[] }> {
  const given = (refs ?? []).filter(isRef)
  const found = new Map<string, Pick<Asset, 'id' | 'name'>>()
  for (const name of assetTokenNames(text)) {
    const ref = given.find((r) => r.name.toLowerCase() === name)
    const asset = ref ? library.get(ref.assetId) : library.byName(name)
    if (!asset) {
      return ref
        ? fail('not-found', gone(ref.name))
        : fail('invalid-input', `No asset called ${name}.`)
    }
    found.set(name, asset)
  }
  const rewritten = parseAssetTokens(text)
    .map((s) => (s.type === 'text' ? s.text : `{{${found.get(s.name)?.name ?? s.name}}}`))
    .join('')
  const distinct = new Map([...found.values()].map((a) => [a.id, { assetId: a.id, name: a.name }]))
  return ok({ text: rewritten, refs: [...distinct.values()] })
}

/** Claude's text with unknown tokens turned into bare words; known ones get the library's own spelling. */
export function sanitiseAssistantTokens(
  text: string,
  library: Pick<TokenLibrary, 'byName'>
): { text: string; refs: ChatAssetRef[] } {
  const refs = new Map<string, ChatAssetRef>()
  const clean = parseAssetTokens(text)
    .map((segment) => {
      if (segment.type === 'text') return segment.text
      const asset = library.byName(segment.name)
      if (!asset) return segment.name
      refs.set(asset.id, { assetId: asset.id, name: asset.name })
      return `{{${asset.name}}}`
    })
    .join('')
  return { text: clean, refs: [...refs.values()] }
}

/** The end of a text that may be the start of a token: `{`, `{{`, `{{scho`, `{{school_logo}`. */
const OPEN_TAIL = /(\{\{[A-Za-z0-9_\s]{0,66}\}?|\{)$/

/**
 * Streaming version of `sanitiseAssistantTokens`: deltas arrive in arbitrary pieces, so a token can be cut in
 * half. The gate holds back an unfinished token until it is complete (or cannot be one) and only then lets it out.
 */
export class AssistantTokenGate {
  private pending = ''
  private readonly seen = new Map<string, ChatAssetRef>()

  constructor(private readonly library: Pick<TokenLibrary, 'byName'>) {}

  /** The assets named so far (known ones only). */
  get refs(): ChatAssetRef[] {
    return [...this.seen.values()]
  }

  /** The part of `delta` that is safe to show now (maybe empty). */
  push(delta: string): string {
    const buffer = this.pending + delta
    const open = OPEN_TAIL.exec(buffer)
    const safe = open ? buffer.slice(0, open.index) : buffer
    this.pending = open ? buffer.slice(open.index) : ''
    return this.clean(safe)
  }

  /** Whatever is still held (an unfinished token is just text now). Call once at the end of the reply. */
  flush(): string {
    const rest = this.pending
    this.pending = ''
    return this.clean(rest)
  }

  private clean(text: string): string {
    if (!text) return ''
    const result = sanitiseAssistantTokens(text, this.library)
    for (const ref of result.refs) this.seen.set(ref.assetId, ref)
    return result.text
  }
}
