/**
 * Runtime validation for StyleProfile (design/style-profile.md §1). Everything read from disk or returned
 * by Claude passes through `parseStyleProfile` before the app trusts it. Pure zod; no Node/DOM imports.
 */
import { z } from 'zod'
import { ANCHORS, type PictureHabits } from '../assets/types'
import type { Slide } from '../deck/types'
import type {
  ComponentStyle,
  Correction,
  Exemplar,
  FontSpec,
  LayoutTemplate,
  SlideTypeHabit,
  SourceRef,
  StyleProfile,
  VoiceProfile
} from './types'

export const SLIDE_KINDS = [
  'title',
  'do-now',
  'objectives',
  'key-words',
  'content',
  'question',
  'activity',
  'practical',
  'check',
  'plenary',
  'exit-ticket',
  'quiz',
  'answers',
  'section',
  'custom'
] as const

export const slideKindSchema = z.enum(SLIDE_KINDS)
export const hexSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Expected a #RRGGBB colour')

const units = z.number().finite()
const confidence = z.enum(['low', 'medium', 'high'])

export const fontSpecSchema = z.object({
  family: z.string().min(1),
  weight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800)]),
  sizePt: z.number().positive(),
  sizeRangePt: z.tuple([z.number().positive(), z.number().positive()]).optional(),
  fallbackStack: z.string(),
  available: z.boolean()
}) satisfies z.ZodType<FontSpec>

export const componentStyleSchema = z.object({
  description: z.string(),
  font: z.enum(['title', 'body', 'accent']).optional(),
  sizePt: z.number().positive().optional(),
  bold: z.boolean().optional(),
  color: z.string().optional(),
  fill: z.string().optional(),
  radius: units.optional(),
  padding: z.tuple([units, units]).optional(),
  uppercase: z.boolean().optional(),
  letterSpacingEm: z.number().finite().optional(),
  rules: z.array(z.string()).optional()
}) satisfies z.ZodType<ComponentStyle>

export const layoutTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  usedFor: z.array(slideKindSchema),
  regions: z.array(
    z.object({
      name: z.string(),
      elementType: z.enum(['text', 'chips', 'callout', 'image', 'diagram', 'shape', 'table']),
      x: units,
      y: units,
      w: units,
      h: units,
      styleRef: z.string().optional(),
      optional: z.boolean().optional()
    })
  ),
  decorations: z.array(z.string())
}) satisfies z.ZodType<LayoutTemplate>

export const slideTypeHabitSchema = z.object({
  kind: slideKindSchema,
  name: z.string(),
  frequency: z.enum(['always', 'often', 'sometimes']),
  description: z.string(),
  typicalPosition: z.enum(['start', 'middle', 'end', 'repeated']).optional(),
  exampleText: z.string().optional()
}) satisfies z.ZodType<SlideTypeHabit>

export const voiceProfileSchema = z.object({
  spelling: z.enum(['en-GB', 'en-US']),
  readingAge: z.string().optional(),
  rules: z.array(z.string()),
  phrases: z.array(z.string()),
  questionStyle: z.string().optional()
}) satisfies z.ZodType<VoiceProfile>

/** Exemplar slides are digested deck-model slides; the full deck schema lives with the deck module. */
const slideDigestSchema = z.custom<Slide>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Slide).id === 'string' &&
    typeof (value as Slide).kind === 'string' &&
    Array.isArray((value as Slide).elements),
  'Expected a slide'
)

export const exemplarSchema = z.object({
  sourceId: z.string(),
  page: z.number().int().positive(),
  kind: slideKindSchema,
  digest: slideDigestSchema,
  why: z.string()
}) satisfies z.ZodType<Exemplar>

export const sourceRefSchema = z.object({
  id: z.string().min(1),
  fileName: z.string(),
  kind: z.enum(['pdf', 'pptx']),
  pages: z.number().int().nonnegative(),
  status: z.enum(['waiting', 'reading', 'learned', 'failed']),
  error: z.string().optional(),
  addedAt: z.string()
}) satisfies z.ZodType<SourceRef>

export const correctionSchema = z.object({
  text: z.string(),
  at: z.string(),
  appliedInVersion: z.number().int().nonnegative()
}) satisfies z.ZodType<Correction>

const pictureBox = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite().min(0),
  h: z.number().finite().min(0)
})

/**
 * `StyleProfile.pictures`. Mirrors `pictureHabitsSchema` in assets/schema.ts; it lives here too because that file imports
 * `slideKindSchema` from this one (a shared import would be a cycle).
 */
export const profilePicturesSchema = z.object({
  lines: z.array(z.string()),
  slideKinds: z.array(
    z.object({
      kind: slideKindSchema,
      pictures: z.enum(['always', 'usually', 'sometimes', 'never']),
      typicalBox: pictureBox.nullable()
    })
  ),
  placements: z.array(
    z.object({
      assetId: z.string().min(1),
      slideKind: z.union([z.literal('every'), slideKindSchema]),
      anchor: z.enum(ANCHORS),
      widthUnits: z.number().positive(),
      marginUnits: z.number().min(0),
      decks: z.number().int().nonnegative()
    })
  )
}) satisfies z.ZodType<PictureHabits>

export const styleProfileSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string(),
  version: z.number().int().nonnegative(),
  isDefault: z.boolean(),
  status: z.enum(['draft', 'learning', 'ready', 'failed']),
  tokens: z.object({
    colors: z.record(
      z.string(),
      z.object({ hex: hexSchema, label: z.string(), usage: z.string() })
    ),
    fonts: z.object({
      title: fontSpecSchema,
      body: fontSpecSchema,
      accent: fontSpecSchema.optional()
    })
  }),
  components: z.record(z.string(), componentStyleSchema),
  layouts: z.array(layoutTemplateSchema),
  slideTypes: z.array(slideTypeHabitSchema),
  lessonFlow: z.array(slideKindSchema),
  voice: voiceProfileSchema,
  habits: z.array(z.string()),
  exemplars: z.array(exemplarSchema),
  sources: z.array(sourceRefSchema),
  corrections: z.array(correctionSchema),
  pictures: profilePicturesSchema.optional(),
  fontsNeeded: z.array(z.string()).optional(),
  confidence: z.object({
    colors: confidence,
    fonts: confidence,
    layouts: confidence,
    voice: confidence,
    slideTypes: confidence
  }),
  createdAt: z.string(),
  updatedAt: z.string()
}) satisfies z.ZodType<StyleProfile>

/** Parses unknown data into a StyleProfile; throws a ZodError describing the first problems. */
export function parseStyleProfile(raw: unknown): StyleProfile {
  return styleProfileSchema.parse(raw)
}

/** Non-throwing variant: `{ ok: true, profile }` or `{ ok: false, error }` with a short readable reason. */
export function safeParseStyleProfile(
  raw: unknown
): { ok: true; profile: StyleProfile } | { ok: false; error: string } {
  const result = styleProfileSchema.safeParse(raw)
  if (result.success) return { ok: true, profile: result.data }
  const issue = result.error.issues[0]
  return { ok: false, error: `${issue.path.join('.') || 'profile'}: ${issue.message}` }
}
