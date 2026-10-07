/** `deck-builder:placeAsset` arguments come over IPC, so they are checked here before anything touches a lesson. */
import { z } from 'zod'
import type { PlaceAssetArgs } from '@shared/assets/place'
import { ANCHORS } from '@shared/assets/types'
import { fail, ok, type Result } from '@shared/result'

const point = z.tuple([z.number(), z.number()])
const box = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
const id = z.string().min(1).max(200)
const name = z.string().max(64).optional()

const placeArgsSchema = z.object({
  lessonId: id,
  slideId: id,
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('library'), assetId: id }),
    z.object({ kind: z.literal('online'), resultId: id, name }),
    z.object({ kind: z.literal('made'), jobId: id, version: z.number().int().min(0), name })
  ]),
  target: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('region'),
      path: z.array(point).max(2000),
      bbox: box,
      replaceElementId: id.nullable()
    }),
    z.object({ kind: z.literal('spot'), elementId: id }),
    z.object({
      kind: z.literal('anchor'),
      anchor: z.enum(ANCHORS),
      widthUnits: z.number().min(16).max(1920).optional()
    }),
    z.object({ kind: z.literal('box'), box })
  ]),
  fit: z.enum(['fit', 'fill'])
})

export const BAD_PLACE_ARGS = 'I can’t tell where to put that picture. Try again.'

/** The arguments as `PlaceAssetArgs`, or an `invalid-input` failure. */
export function checkPlaceArgs(raw: unknown): Result<{ args: PlaceAssetArgs }> {
  const parsed = placeArgsSchema.safeParse(raw)
  return parsed.success
    ? ok({ args: parsed.data as PlaceAssetArgs })
    : fail('invalid-input', BAD_PLACE_ARGS)
}
