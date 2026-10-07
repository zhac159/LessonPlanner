/**
 * The picture calls (agents/ASSETS.md §5): `describeAssets` (name and describe, cheap, batched, cached by
 * sha256), `describeStyleOfAssets` (the look of picked pictures, for the picture maker) and `drawSvg`
 * (vector mode: Claude draws, the app sanitises). All three use the cheaper model and low effort.
 */
import { createHash } from 'node:crypto'
import { fail } from '@shared/result'
import { CHEAPER_MODEL } from '@shared/ai/prices'
import type { CallOptions, DescribedAsset, DescribeImageInput } from '@shared/ai/types'
import type { AssetKind } from '@shared/assets'
import { sanitiseSvg } from '@shared/deck/svg'
import { AiCallError, aiError } from '../errors'
import {
  DESCRIBE_INSTRUCTIONS,
  STYLE_INSTRUCTIONS,
  STYLE_TASK,
  SVG_INSTRUCTIONS,
  describeTask,
  pictureLabel,
  svgTask
} from '../prompts/pictures'
import { buildSystem } from '../prompts/context'
import {
  DESCRIBE_BATCH,
  STYLE_IMAGES_MAX,
  SVG_VERSIONS_MAX,
  cleanFacts,
  cleanStyle,
  describeWire,
  describedFrom,
  olderOf,
  styleWire,
  svgWire,
  type PictureFacts
} from '../schemas/pictures'
import type { ContentBlockParam } from '../sdk'
import { textBlock, type CallDeps } from './deps'

// ---- the cache: a picture is described once, ever (describe-cache.json in the assets module, §2.7)

/** Where descriptions are remembered, by the file's sha256. The app gives a file-backed one; the default lives in memory. */
export interface DescribeCache {
  get(sha256: string): PictureFacts | undefined | Promise<PictureFacts | undefined>
  set(sha256: string, facts: PictureFacts): void | Promise<void>
}

export function createMemoryDescribeCache(): DescribeCache {
  const entries = new Map<string, PictureFacts>()
  return {
    get: (sha256) => {
      const hit = entries.get(sha256)
      return hit && structuredClone(hit)
    },
    set: (sha256, facts) => void entries.set(sha256, structuredClone(facts))
  }
}

const sha256Of = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

/** The cache is an optimisation: a broken one must never fail a call. */
async function safely<T>(task: () => T | Promise<T>): Promise<T | undefined> {
  try {
    return await task()
  } catch {
    return undefined
  }
}

// ---- image blocks

type MediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'

function mediaTypeOf(bytes: Uint8Array): MediaType {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) return 'image/webp'
  return 'image/png'
}

/** An `image` block; the media type is read from the bytes (thumbnails may be PNG or JPEG). */
export const imageBlock = (bytes: Uint8Array): ContentBlockParam => ({
  type: 'image',
  source: {
    type: 'base64',
    media_type: mediaTypeOf(bytes),
    data: Buffer.from(bytes).toString('base64')
  }
})

const invalid = (message: string): AiCallError => new AiCallError(fail('invalid-input', message))

// ---- describeAssets

export async function describeAssets(
  { runner }: CallDeps,
  input: { images: DescribeImageInput[]; taken: string[] },
  opts: CallOptions = {},
  cache: DescribeCache = createMemoryDescribeCache()
): Promise<{ described: DescribedAsset[] }> {
  const { images } = input
  if (new Set(images.map((image) => image.index)).size !== images.length)
    throw invalid('Each picture needs its own number.')

  const shaOf = new Map(images.map((i) => [i.index, i.sha256 ?? sha256Of(i.png)]))
  const facts = new Map<string, PictureFacts>() // by sha256
  const links = new Map<number, number | null>() // older-version links found in this call
  const misses: DescribeImageInput[] = []
  const queued = new Set<string>()
  for (const image of images) {
    const sha = shaOf.get(image.index)!
    if (facts.has(sha) || queued.has(sha)) continue
    const hit = await safely(() => cache.get(sha))
    if (hit) facts.set(sha, hit)
    else {
      queued.add(sha)
      misses.push(image)
    }
  }

  for (let from = 0; from < misses.length; from += DESCRIBE_BATCH) {
    const batch = misses.slice(from, from + DESCRIBE_BATCH)
    const content: ContentBlockParam[] = batch.flatMap((image) => [
      textBlock(pictureLabel(image.index)),
      imageBlock(image.png)
    ])
    content.push(textBlock(describeTask(batch, input.taken)))
    const { data } = await runner.runStructured(
      {
        task: 'describeAssets',
        model: CHEAPER_MODEL,
        system: buildSystem({ instructions: [DESCRIBE_INSTRUCTIONS] }),
        messages: [{ role: 'user', content }],
        schema: describeWire,
        effort: 'low',
        maxTokens: 8000
      },
      opts
    )
    const byIndex = new Map(batch.map((image) => [image.index, image]))
    const indexes = new Set(byIndex.keys())
    for (const item of data.items) {
      const image = byIndex.get(item.index)
      if (!image || links.has(item.index)) continue
      const sha = shaOf.get(item.index)!
      const clean = cleanFacts(item, image.hint)
      facts.set(sha, clean)
      links.set(item.index, olderOf(item.olderVersionOf, item.index, indexes))
      await safely(() => cache.set(sha, clean))
    }
  }

  const used = new Set(input.taken.map((name) => name.toLowerCase()))
  const described: DescribedAsset[] = []
  for (const image of images) {
    const found = facts.get(shaOf.get(image.index)!)
    if (found)
      described.push(describedFrom(image.index, found, links.get(image.index) ?? null, used))
  }
  if (images.length > 0 && described.length === 0) throw aiError('unknown')
  return { described }
}

// ---- describeStyleOfAssets

export async function describeStyleOfAssets(
  { runner }: CallDeps,
  input: { images: Uint8Array[]; kinds: AssetKind[] },
  opts: CallOptions = {}
): Promise<{ description: string }> {
  const images = input.images.slice(0, STYLE_IMAGES_MAX)
  if (images.length === 0) throw invalid('Pick at least one picture to describe.')
  const content: ContentBlockParam[] = images.flatMap((image, i) => [
    textBlock(`Picture ${i + 1}${input.kinds[i] ? ` (${input.kinds[i]})` : ''}:`),
    imageBlock(image)
  ])
  content.push(textBlock(STYLE_TASK))
  const { data } = await runner.runStructured(
    {
      task: 'describeStyleOfAssets',
      model: CHEAPER_MODEL,
      system: buildSystem({ instructions: [STYLE_INSTRUCTIONS] }),
      messages: [{ role: 'user', content }],
      schema: styleWire,
      effort: 'low',
      maxTokens: 4000
    },
    opts
  )
  const description = cleanStyle(data.description)
  if (!description) throw aiError('unknown')
  return { description }
}

// ---- drawSvg

/** At least one shape: an empty `<svg/>` is a failed drawing. */
const hasShapes = (svg: string): boolean =>
  /<(?:path|rect|circle|ellipse|line|polyline|polygon)\b/.test(svg)

export async function drawSvg(
  { runner }: CallDeps,
  input: { prompt: string; styleDescription: string; kind: AssetKind; versions: number },
  opts: CallOptions = {}
): Promise<{ svgs: string[] }> {
  if (input.kind === 'photo') throw invalid('A photograph can’t be drawn. Connect a picture maker.')
  if (!input.prompt.trim()) throw invalid('Say what to draw.')
  const versions = Math.min(SVG_VERSIONS_MAX, Math.max(1, Math.round(input.versions) || 1))
  const { data } = await runner.runStructured(
    {
      task: 'drawSvg',
      model: CHEAPER_MODEL,
      system: buildSystem({ instructions: [SVG_INSTRUCTIONS] }),
      messages: [{ role: 'user', content: [textBlock(svgTask({ ...input, versions }))] }],
      schema: svgWire,
      effort: 'low',
      maxTokens: 16_000
    },
    opts
  )
  const svgs: string[] = []
  for (const raw of data.svgs.slice(0, versions)) {
    const clean = sanitiseSvg(raw)
    if (clean.ok && hasShapes(clean.svg) && !svgs.includes(clean.svg)) svgs.push(clean.svg)
  }
  if (svgs.length === 0) throw aiError('unknown')
  return { svgs }
}
