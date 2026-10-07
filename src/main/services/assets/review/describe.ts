/**
 * The naming step of the review queue (agents/ASSETS.md §5.2): which candidates go to Claude, the cache in front
 * of the call, and what a description changes on a candidate. Pictures that may show pupils never leave the PC.
 */
import type { AiService, DescribeImageInput } from '@shared/ai/types'
import { ASSET_KINDS } from '@shared/assets/types'
import { uniqueAssetName } from '@shared/assets/names'
import type { DescribeCache } from '../../../ai/calls/pictures'
import type { PictureFacts } from '../../../ai/schemas/pictures'
import type { ImageTools } from '../imageTools'
import { cleanDescription, cleanTitle, normaliseTags } from '../library'
import { DESCRIBE_SIDE, type StoredCandidate } from './types'

export interface NamingDeps {
  ai: Pick<AiService, 'describeAssets'>
  tools: ImageTools
  cache: DescribeCache
}

export interface Described {
  facts: PictureFacts
  /** Id of the candidate Claude called a clearly better copy of this one, if any. */
  olderOfId: string | null
}

/** Sent to Claude: not yet described, not already in the library, and never anything that may show pupils. */
export const needsNaming = (c: StoredCandidate): boolean =>
  !c.named &&
  !c.duplicateOf &&
  !c.claudePupils &&
  c.extractorReason !== 'pupils' &&
  c.extractorReason !== 'unreadable'

export interface NamingItem {
  candidate: StoredCandidate
  bytes: Uint8Array
}

/**
 * Describes up to one chunk: the cache first, then one Claude call for the rest. `failed` is true when the call
 * did not work (the candidates keep the extractor's names); whatever came from the cache is still returned.
 */
export async function describeChunk(
  deps: NamingDeps,
  items: readonly NamingItem[],
  taken: readonly string[],
  signal?: AbortSignal
): Promise<{ described: Map<string, Described>; failed: boolean }> {
  const described = new Map<string, Described>()
  const misses: NamingItem[] = []
  for (const item of items) {
    const hit = await Promise.resolve(deps.cache.get(item.candidate.sha256)).catch(() => undefined)
    if (hit) described.set(item.candidate.id, { facts: hit, olderOfId: null })
    else misses.push(item)
  }
  if (misses.length === 0) return { described, failed: false }

  const images: DescribeImageInput[] = []
  const byIndex = new Map<number, NamingItem>()
  for (const item of misses) {
    const small = await deps.tools.scale(item.bytes, item.candidate.ext, DESCRIBE_SIDE)
    if (!small) continue
    const index = images.length + 1
    byIndex.set(index, item)
    images.push({
      index,
      png: small.png,
      hint: item.candidate.hint,
      nearbyText: item.candidate.nearbyText,
      fileNames: item.candidate.fileNames,
      sha256: item.candidate.sha256
    })
  }
  if (images.length === 0) return { described, failed: true }

  const result = await deps.ai.describeAssets({ images, taken: [...taken] }, { signal })
  if (!result.ok) return { described, failed: true }
  for (const d of result.described) {
    const item = byIndex.get(d.index)
    if (!item) continue
    const facts: PictureFacts = {
      title: d.title,
      name: d.name,
      kind: d.kind,
      description: d.description,
      tags: d.tags,
      maybePupils: d.maybePupils,
      blurry: d.blurry
    }
    described.set(item.candidate.id, {
      facts,
      olderOfId: d.olderVersionOf ? (byIndex.get(d.olderVersionOf)?.candidate.id ?? null) : null
    })
    await Promise.resolve(deps.cache.set(item.candidate.sha256, facts)).catch(() => undefined)
  }
  return { described, failed: false }
}

/**
 * Writes a description into a candidate. Fields she edited by hand stay as they are. Claude's kind wins over the
 * extractor's hint; Claude's "blurry" is advice only (it never unticks anything); Claude's "may show pupils" does.
 */
export function applyDescribed(
  candidate: StoredCandidate,
  { facts, olderOfId }: Described,
  takenByOthers: Iterable<string>
): void {
  const edited = new Set(candidate.edited)
  if (!edited.has('name')) {
    candidate.name = uniqueAssetName(facts.name || facts.title || candidate.name, takenByOthers)
  }
  if (!edited.has('title')) candidate.title = cleanTitle(facts.title, candidate.name)
  if (!edited.has('kind') && (ASSET_KINDS as readonly string[]).includes(facts.kind)) {
    candidate.kind = facts.kind
  }
  if (!edited.has('description')) candidate.description = cleanDescription(facts.description)
  candidate.tags = normaliseTags(facts.tags)
  candidate.claudePupils = candidate.claudePupils || facts.maybePupils
  if (olderOfId && olderOfId !== candidate.id) candidate.olderOf = olderOfId
  candidate.named = true
}
