/**
 * Runtime validation for everything stored or received about assets. Everything read from disk
 * (`index.json`, `meta.json`) or returned by Claude passes through these before the app trusts it.
 * Pure zod.
 */
import { z } from 'zod'
import { slideKindSchema } from '../style/schema'
import type { PictureFact, SlideFact } from './habits'
import {
  ANCHORS,
  ASSET_FILE_EXTENSIONS,
  ASSET_KINDS,
  type Asset,
  type AssetCredit,
  type AssetFile,
  type AssetFoundIn,
  type AssetIndex,
  type AssetLicence,
  type AssetSource,
  type ChatAssetRef,
  type PictureHabits,
  type PicturePlacementRule,
  type PictureSpotInfo
} from './types'

export const assetKindSchema = z.enum(ASSET_KINDS)

const isoString = z.string().min(1)

export const assetLicenceSchema = z.object({
  id: z.enum([
    'own',
    'unknown',
    'generated',
    'cc0',
    'public-domain',
    'cc-by',
    'cc-by-sa',
    'cc-by-nc',
    'cc-by-nc-sa',
    'cc-by-nc-nd',
    'cc-by-nd',
    'pexels',
    'unsplash',
    'other'
  ]),
  label: z.string(),
  requiresCredit: z.boolean()
}) satisfies z.ZodType<AssetLicence>

export const assetCreditSchema = z.object({
  text: z.string(),
  inNotes: z.boolean(),
  provider: z.enum(['openverse', 'wikimedia', 'pexels', 'unsplash']).nullable(),
  author: z.string().nullable(),
  title: z.string().nullable(),
  pageUrl: z.string().nullable(),
  licenceUrl: z.string().nullable()
}) satisfies z.ZodType<AssetCredit>

export const assetSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('uploaded'), fileName: z.string(), at: isoString }),
  z.object({
    kind: z.literal('extracted'),
    styleId: z.string().nullable(),
    fileName: z.string(),
    page: z.number().int().positive().nullable(),
    at: isoString
  }),
  z.object({
    kind: z.literal('online'),
    provider: z.enum(['openverse', 'wikimedia', 'pexels', 'unsplash']),
    at: isoString
  }),
  z.object({
    kind: z.literal('generated'),
    model: z.string(),
    prompt: z.string(),
    basedOn: z.array(z.string()),
    at: isoString
  })
]) satisfies z.ZodType<AssetSource>

export const assetFileSchema = z.object({
  ext: z.enum(ASSET_FILE_EXTENSIONS),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  phash: z
    .string()
    .regex(/^[0-9a-f]{16}$/)
    .nullable(),
  vector: z.boolean(),
  dropped: z.array(z.string().max(120)).max(40).optional()
}) satisfies z.ZodType<AssetFile>

export const assetFoundInSchema = z.object({
  styleId: z.string().nullable(),
  sourceId: z.string(),
  fileName: z.string(),
  page: z.number().int().positive().nullable()
}) satisfies z.ZodType<AssetFoundIn>

export const assetSchema = z.object({
  id: z.string().min(1),
  // Stored names are not re-validated against the naming rules: a rule change must never lose a library.
  name: z.string().min(1),
  title: z.string(),
  kind: assetKindSchema,
  description: z.string(),
  tags: z.array(z.string()),
  source: assetSourceSchema,
  licence: assetLicenceSchema,
  credit: assetCreditSchema.nullable(),
  file: assetFileSchema,
  foundIn: z.array(assetFoundInSchema),
  usedIn: z.array(z.string()),
  lastUsedAt: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString
}) satisfies z.ZodType<Asset>

export const assetIndexSchema = z.object({
  schemaVersion: z.literal(1),
  assets: z.array(assetSchema),
  updatedAt: isoString
}) satisfies z.ZodType<AssetIndex>

export const chatAssetRefSchema = z.object({
  assetId: z.string().min(1),
  name: z.string().min(1)
}) satisfies z.ZodType<ChatAssetRef>

/** `ImageElement.placeholder`: `{ description }` stays valid; the rest is optional. */
export const pictureSpotSchema = z.object({
  description: z.string(),
  kind: assetKindSchema.optional(),
  query: z.string().optional(),
  suggestedAssets: z.array(z.string()).optional()
}) satisfies z.ZodType<PictureSpotInfo>

const box = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite().min(0),
  h: z.number().finite().min(0)
})

export const picturePlacementRuleSchema = z.object({
  assetId: z.string().min(1),
  slideKind: z.union([z.literal('every'), slideKindSchema]),
  anchor: z.enum(ANCHORS),
  widthUnits: z.number().positive(),
  marginUnits: z.number().min(0),
  decks: z.number().int().nonnegative()
}) satisfies z.ZodType<PicturePlacementRule>

export const pictureHabitsSchema = z.object({
  lines: z.array(z.string()),
  slideKinds: z.array(
    z.object({
      kind: slideKindSchema,
      pictures: z.enum(['always', 'usually', 'sometimes', 'never']),
      typicalBox: box.nullable()
    })
  ),
  placements: z.array(picturePlacementRuleSchema)
}) satisfies z.ZodType<PictureHabits>

/** Parses an `index.json` or a `meta.json` body; `{ ok: false }` carries a short readable reason. */
export function safeParseAssetIndex(
  raw: unknown
): { ok: true; index: AssetIndex } | { ok: false; error: string } {
  const result = assetIndexSchema.safeParse(raw)
  if (result.success) return { ok: true, index: result.data }
  const issue = result.error.issues[0]
  return { ok: false, error: `${issue.path.join('.') || 'index'}: ${issue.message}` }
}

export function safeParseAsset(
  raw: unknown
): { ok: true; asset: Asset } | { ok: false; error: string } {
  const result = assetSchema.safeParse(raw)
  if (result.success) return { ok: true, asset: result.data }
  const issue = result.error.issues[0]
  return { ok: false, error: `${issue.path.join('.') || 'asset'}: ${issue.message}` }
}

/**
 * `sources/<id>.pictures.json` of a style: what the extraction service saw in ONE file, kept so habits can be
 * rebuilt when files are added, removed or restored without reading the decks again.
 */
export const pictureFactsFileSchema = z.object({
  schemaVersion: z.literal(1),
  slides: z.array(
    z.object({
      sourceId: z.string(),
      slideNumber: z.number().int().positive(),
      slideKind: slideKindSchema.nullable()
    })
  ) satisfies z.ZodType<SlideFact[]>,
  pictures: z.array(
    z.object({
      sourceId: z.string(),
      slideNumber: z.number().int().positive(),
      slideKind: slideKindSchema.nullable(),
      assetKey: z.string(),
      box: box,
      kind: assetKindSchema
    })
  ) satisfies z.ZodType<PictureFact[]>
})
export type PictureFactsFile = z.infer<typeof pictureFactsFileSchema>
