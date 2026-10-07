/**
 * What is read from the picked assets for a job (agents/ASSETS.md §5.6, §7): small thumbnails for Claude's style
 * description, and, for the picture maker, the pictures themselves as style references.
 * Owner decision (2026-10-07): only DRAWN kinds go to Google as references, never photos or anything else.
 */
import type { Asset, AssetKind } from '@shared/assets/types'
import type { MakeAssetsPort } from './types'

export const DRAWN_KINDS: ReadonlySet<AssetKind> = new Set([
  'logo',
  'icon',
  'diagram',
  'banner',
  'character',
  'symbol-card'
])
export const MAX_BASED_ON = 6
const STYLE_THUMB_SIDE = 384
const REFERENCE_SIDE = 1024

/** The most frequent kind (first seen wins a tie), or undefined for no assets. */
export function mostCommonKind(assets: readonly Asset[]): AssetKind | undefined {
  const counts = new Map<AssetKind, number>()
  for (const a of assets) counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1)
  let best: AssetKind | undefined
  for (const [kind, n] of counts) if (best === undefined || n > counts.get(best)!) best = kind
  return best
}

/** The ids that still exist, without repeats, at most `MAX_BASED_ON`. */
export function pickedAssets(port: MakeAssetsPort, ids: readonly string[]): Asset[] {
  const seen = new Set<string>()
  const found: Asset[] = []
  for (const id of ids) {
    const asset = typeof id === 'string' && !seen.has(id) ? port.store.get(id) : undefined
    seen.add(id)
    if (asset) found.push(asset)
  }
  return found.slice(0, MAX_BASED_ON)
}

export interface StyleInputs {
  thumbnails: Uint8Array[]
  kinds: AssetKind[]
  /** Pictures for the picture maker: drawn kinds only. */
  references: Uint8Array[]
}

export async function loadStyleInputs(
  port: MakeAssetsPort,
  assets: readonly Asset[],
  withReferences: boolean
): Promise<StyleInputs> {
  const out: StyleInputs = { thumbnails: [], kinds: [], references: [] }
  for (const asset of assets) {
    const bytes = await port.readOriginal(asset.id)
    if (!bytes) continue
    const thumb = await port.tools.scale(bytes, asset.file.ext, STYLE_THUMB_SIDE)
    if (thumb) {
      out.thumbnails.push(thumb.png)
      out.kinds.push(asset.kind)
    }
    if (withReferences && DRAWN_KINDS.has(asset.kind)) {
      const ref = await port.tools.scale(bytes, asset.file.ext, REFERENCE_SIDE)
      if (ref) out.references.push(ref.png)
    }
  }
  return out
}

const PHOTO_WORDS = /\b(photos?|photograph(?:s|ic)?|photo-?realistic|realistic|real life)\b/i

/** True when the request asks for a photograph-like picture (vector mode cannot draw those). */
export const asksForPhoto = (request: string): boolean => PHOTO_WORDS.test(request)
