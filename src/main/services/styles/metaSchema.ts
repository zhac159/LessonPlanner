/** Validation for meta.json so a hand-edited or half-written file can never crash the service. */
import { z } from 'zod'
import type { StyleFileErrorCode } from '@shared/contracts/style-library'
import type { Slide } from '@shared/deck/types'
import { sourceRefSchema } from '@shared/style/schema'
import type { StyleMeta } from './types'

const fileMetaSchema = z.object({
  fileName: z.string(),
  kind: z.enum(['pdf', 'pptx']),
  addedAt: z.string(),
  hash: z.string(),
  mayContainNames: z.boolean(),
  error: z
    .object({
      code: z.custom<StyleFileErrorCode>((v) => typeof v === 'string'),
      message: z.string(),
      retryable: z.boolean()
    })
    .optional(),
  sourcePlanPages: z.array(z.number().int().positive()).optional()
})

const slideSchema = z.custom<Slide>(
  (v) => typeof v === 'object' && v !== null && Array.isArray((v as Slide).elements)
)

const metaSchema = z.object({
  nameSource: z.enum(['auto', 'user']),
  saved: z.boolean(),
  synthesised: z.boolean(),
  hasSynthesis: z.boolean(),
  testSlide: slideSchema.nullable(),
  pausedFor: z
    .enum([
      'no-key',
      'invalid-key',
      'no-credit',
      'permission',
      'model-unavailable',
      'rate-limited',
      'overloaded',
      'network',
      'too-large',
      'refused',
      'unknown'
    ])
    .optional(),
  files: z.record(z.string(), fileMetaSchema),
  pictures: z
    .object({
      batchId: z.string().nullable(),
      keys: z.record(z.string(), z.object({ sha: z.string(), keep: z.boolean() })),
      kept: z.array(z.string())
    })
    .optional(),
  removed: z.record(
    z.string(),
    z.object({ source: sourceRefSchema, file: fileMetaSchema, at: z.string() })
  )
}) satisfies z.ZodType<StyleMeta>

/** Throws when `raw` is not a valid StyleMeta. */
export const parseStyleMeta = (raw: unknown): StyleMeta => metaSchema.parse(raw)

export const emptyMeta = (): StyleMeta => ({
  nameSource: 'auto',
  saved: false,
  synthesised: false,
  hasSynthesis: false,
  testSlide: null,
  files: {},
  removed: {}
})
