/**
 * The chat's asset tools (agents/ASSETS.md §4.2, §5.4): `list_assets` searches the teacher's library (names and
 * words, never pictures) and `place_asset` puts one on a slide as ONE change through the host. Both are `strict`.
 */
import { z } from 'zod'
import type { ChatAssets, ChatSink, PlaceToolArgs } from '@shared/ai/types'
import { ANCHORS, ASSET_KINDS } from '@shared/assets/types'
import { stableStringify } from '../json'
import type { ToolUseBlock } from '../sdk'
import { invalidInput, text, tool, type ToolOutcome } from './toolKit'

export const LIST_ASSETS = tool(
  'list_assets',
  "Searches the teacher's assets (her own pictures): names, kinds, titles, descriptions and tags, no pictures. Use it when the library is longer than the list you were given, or to find one for a picture spot.",
  {
    query: { type: 'string', description: 'Words to look for, or "" for the most used.' },
    kind: {
      type: 'string',
      enum: ['any', ...ASSET_KINDS],
      description: 'Only this kind of picture, or "any".'
    }
  },
  ['query', 'kind'],
  true
)
export const PLACE_ASSET = tool(
  'place_asset',
  "Places one of the teacher's assets on a slide as ONE change (one undo step), copying it into the lesson and keeping its own shape. Say where with exactly one of: anchor (a corner, edge or the centre), a box (boxW > 0), region (the number of a circled region of this message) or spot (the element id of a picture spot). Unused values are 'none', 0 or ''. Credits are added to the notes for you.",
  {
    asset: { type: 'string', description: 'The exact asset name, without braces.' },
    slideId: { type: 'string' },
    anchor: { type: 'string', enum: ['none', ...ANCHORS] },
    boxX: { type: 'number' },
    boxY: { type: 'number' },
    boxW: { type: 'number', description: '0 when no box is used.' },
    boxH: { type: 'number' },
    region: { type: 'integer', description: 'Number of a circled region, 0 when none.' },
    spot: { type: 'string', description: 'Element id of a picture spot, "" when none.' },
    widthUnits: { type: 'number', description: 'Width in slide units for an anchor; 0 = default.' },
    fit: { type: 'string', enum: ['fit', 'fill'] },
    replaceUnder: {
      type: 'boolean',
      description: 'True only when she said replace or swap: update the picture under the circle.'
    }
  },
  [
    'asset',
    'slideId',
    'anchor',
    'boxX',
    'boxY',
    'boxW',
    'boxH',
    'region',
    'spot',
    'widthUnits',
    'fit',
    'replaceUnder'
  ],
  true
)

const listAssetsInput = z.object({ query: z.string(), kind: z.string() })
const placeInput = z.object({
  asset: z.string().min(1),
  slideId: z.string().min(1),
  anchor: z.enum(['none', ...ANCHORS]),
  boxX: z.number(),
  boxY: z.number(),
  boxW: z.number(),
  boxH: z.number(),
  region: z.number().int().min(0),
  spot: z.string(),
  widthUnits: z.number().min(0),
  fit: z.enum(['fit', 'fill']),
  replaceUnder: z.boolean()
})

/** Runs `list_assets` or `place_asset`. A refusal of `place_asset` is an error result the model can act on. */
export async function runAssetTool(
  block: ToolUseBlock,
  assets: ChatAssets,
  sink: ChatSink
): Promise<ToolOutcome> {
  if (block.name === 'list_assets') {
    const parsed = listAssetsInput.safeParse(block.input)
    if (!parsed.success) return invalidInput(block.id, parsed.error)
    const found = assets.list(parsed.data).map((a) => ({
      name: a.name,
      kind: a.kind,
      title: a.title,
      description: a.description,
      tags: a.tags
    }))
    return { rejected: false, result: text(block.id, stableStringify({ assets: found })) }
  }
  const parsed = placeInput.safeParse(block.input)
  if (!parsed.success) return invalidInput(block.id, parsed.error)
  const placed = await assets.place(parsed.data as PlaceToolArgs)
  if (!placed.ok) return { rejected: false, result: text(block.id, placed.error, true) }
  sink.changes(placed.changeSet)
  return {
    rejected: false,
    result: text(
      block.id,
      stableStringify({
        ok: true,
        changeSetId: placed.changeSet.id,
        elementId: placed.elementId,
        placed: placed.placed
      })
    )
  }
}
