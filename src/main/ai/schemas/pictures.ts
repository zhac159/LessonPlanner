/**
 * Wire schemas and mappers for the picture calls (agents/ASSETS.md §5). Flat and small on purpose: the API
 * refused a big nested schema as "compiled grammar too large", so every call here has ONE nesting level, no
 * optional fields, no unions.
 */
import { z } from 'zod'
import type { AssetKindHint, DescribedAsset } from '@shared/ai/types'
import { ASSET_KINDS, uniqueAssetName, type AssetKind } from '@shared/assets'

/** Pictures per describe request. */
export const DESCRIBE_BATCH = 12
/** Pictures per style-description request. */
export const STYLE_IMAGES_MAX = 6
/** SVG drawings per request. */
export const SVG_VERSIONS_MAX = 4

const kind = z.enum(ASSET_KINDS)

export const describeWire = z.object({
  items: z.array(
    z.object({
      index: z.number().describe('the picture number you were given'),
      title: z.string().describe('1 to 4 words, e.g. School logo'),
      name: z.string().describe('lower_snake_case, 2 to 32 characters, e.g. beaker_icon'),
      kind,
      description: z.string().describe('1 to 2 plain sentences'),
      tags: z.array(z.string()).describe('up to 5 lower-case words'),
      maybePupils: z.boolean(),
      blurry: z.boolean(),
      olderVersionOf: z.number().describe('number of a clearly better copy in this batch, else -1')
    })
  )
})
export type DescribeWire = z.infer<typeof describeWire>

export const styleWire = z.object({
  description: z.string().describe('one paragraph, at most 60 words')
})

export const svgWire = z.object({
  svgs: z.array(z.string().describe('one complete <svg> document'))
})

/** What is kept of a description (the cache stores exactly this; `olderVersionOf` is relative to a batch). */
export interface PictureFacts {
  title: string
  name: string
  kind: AssetKind
  description: string
  tags: string[]
  maybePupils: boolean
  blurry: boolean
}

const clamp = (text: string, max: number): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trim()
}

/** Kind to fall back on when the model's kind is unusable: the extractor's hint ('other' is a picture). */
export const kindFromHint = (hint: AssetKindHint): AssetKind =>
  hint === 'other' ? 'picture' : hint

/** Cleans one item of the wire reply (lengths, tag list); the name is made unique later, in `describedFrom`. */
export function cleanFacts(item: DescribeWire['items'][number], hint: AssetKindHint): PictureFacts {
  const tags: string[] = []
  for (const raw of item.tags) {
    const tag = clamp(raw.toLowerCase(), 24)
    if (tag && !tags.includes(tag)) tags.push(tag)
  }
  return {
    title: clamp(item.title, 60),
    name: item.name,
    kind: (ASSET_KINDS as readonly string[]).includes(item.kind) ? item.kind : kindFromHint(hint),
    description: clamp(item.description, 400),
    tags: tags.slice(0, 5),
    maybePupils: item.maybePupils,
    blurry: item.blurry
  }
}

/** `facts` + the batch-relative link -> `DescribedAsset`, with a name unique among `used` (which grows). */
export function describedFrom(
  index: number,
  facts: PictureFacts,
  olderVersionOf: number | null,
  used: Set<string>
): DescribedAsset {
  const name = uniqueAssetName(facts.name || facts.title, used)
  used.add(name)
  return { index, ...facts, name, olderVersionOf }
}

/** The model's `olderVersionOf` number as an index of another picture in this batch, else null. */
export function olderOf(value: number, self: number, batch: ReadonlySet<number>): number | null {
  return Number.isInteger(value) && value !== self && batch.has(value) ? value : null
}

/** Style description: one paragraph, no markdown, at most 90 words (the prompt asks for 60). */
export function cleanStyle(text: string): string {
  const words = text
    .replace(/[*`]/g, '')
    .replace(/^\s*#+\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
  return words.length <= 90
    ? words.join(' ')
    : `${words
        .slice(0, 90)
        .join(' ')
        .replace(/[,;:]$/, '')}…`
}
