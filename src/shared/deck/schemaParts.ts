/**
 * Building blocks of the deck schemas (schema.ts): colours, runs, paragraphs, elements and slides.
 * Split out so each file stays small; import the schemas from './schema'.
 */
import { z } from 'zod'
import { pictureSpotSchema } from '../assets/schema'
import { sanitiseSvg } from './svg'
import type {
  CalloutTail,
  ColorValue,
  Fill,
  LessonMeta,
  Paragraph,
  Run,
  SlideKind,
  Stroke
} from './types'

// ---- primitives --------------------------------------------------------------------------------

const COLOR_RE = /^(token:[A-Za-z][\w.-]*|#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))$/

/** `token:accent` or `#0E7C7B` (3 or 6 hex digits). */
export const colorValueSchema = z.custom<ColorValue>(
  (v) => typeof v === 'string' && COLOR_RE.test(v),
  'Colour must be "token:<name>" or a hex value such as "#0E7C7B"'
)

const finite = z.number().finite()
export const nonEmpty = z.string().min(1)

export const fillSchema = z.object({
  color: colorValueSchema,
  opacity: z.number().min(0).max(1).optional()
}) satisfies z.ZodType<Fill>

export const strokeSchema = z.object({
  color: colorValueSchema,
  width: z.number().min(0),
  dash: z.enum(['solid', 'dash']).optional()
}) satisfies z.ZodType<Stroke>

export const runSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  color: colorValueSchema.optional()
}) satisfies z.ZodType<Run>

export const paragraphSchema = z.object({
  runs: z.array(runSchema),
  list: z.enum(['none', 'bullet', 'number', 'checkbox']).optional(),
  level: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional()
}) satisfies z.ZodType<Paragraph>

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
] as const satisfies readonly SlideKind[]

export const CALLOUT_TAILS = [
  'bottom-left',
  'bottom-right',
  'top-left',
  'top-right',
  'left',
  'right',
  'none'
] as const satisfies readonly CalloutTail[]

export const slideKindSchema = z.enum(SLIDE_KINDS)

export const lessonMetaSchema = z.object({
  subject: z.string().optional(),
  yearGroup: z.string().optional(),
  durationMin: z.number().min(0).optional(),
  ability: z.string().optional(),
  targetSlideCount: z.number().int().min(0).optional(),
  objectives: z.array(z.string()),
  context: z.string().optional()
}) satisfies z.ZodType<LessonMeta>

/** Diagram SVG is sanitised while parsing, so nothing unsafe can enter a deck by any route. */
const svgSchema = z.string().transform((raw, ctx) => {
  const result = sanitiseSvg(raw)
  if (!result.ok) {
    ctx.addIssue({ code: 'custom', message: `Unsafe or invalid SVG: ${result.error}` })
    return z.NEVER
  }
  return result.svg
})

// ---- elements, slides (id handling is the only difference between strict and lenient) -----------

export function buildElement(id: z.ZodType<string>) {
  const base = {
    id,
    x: finite,
    y: finite,
    w: finite.min(0),
    h: finite.min(0),
    rotation: finite.optional(),
    z: finite.optional(),
    locked: z.boolean().optional(),
    styleRef: z.string().optional(),
    name: z.string().optional()
  }

  const text = z.object({
    ...base,
    type: z.literal('text'),
    role: z.enum(['title', 'kicker', 'subtitle', 'heading', 'body', 'caption', 'label']),
    paragraphs: z.array(paragraphSchema),
    align: z.enum(['left', 'center', 'right']).optional(),
    valign: z.enum(['top', 'middle', 'bottom']).optional(),
    fontSizePt: z.number().positive().optional(),
    autoFit: z.enum(['shrink', 'none']).optional()
  })
  const chips = z.object({ ...base, type: z.literal('chips'), items: z.array(z.string()) })
  const callout = z.object({
    ...base,
    type: z.literal('callout'),
    variant: nonEmpty,
    label: z.string().optional(),
    paragraphs: z.array(paragraphSchema),
    tail: z.enum(CALLOUT_TAILS).optional()
  })
  const image = z.object({
    ...base,
    type: z.literal('image'),
    assetId: z.string().optional(),
    placeholder: pictureSpotSchema.optional(),
    fit: z.enum(['cover', 'contain']),
    alt: z.string(),
    radius: z.number().min(0).optional()
  })
  const diagram = z.object({ ...base, type: z.literal('diagram'), svg: svgSchema, alt: z.string() })
  const shape = z.object({
    ...base,
    type: z.literal('shape'),
    shape: z.enum(['rect', 'roundRect', 'ellipse', 'line', 'arrow']),
    fill: fillSchema.optional(),
    stroke: strokeSchema.optional(),
    radius: z.number().min(0).optional()
  })
  const table = z.object({
    ...base,
    type: z.literal('table'),
    rows: z.array(z.array(z.string())),
    headerRow: z.boolean(),
    colWidths: z.array(z.number().min(0)).optional()
  })

  return z.discriminatedUnion('type', [text, chips, callout, image, diagram, shape, table])
}

export function buildSlide(id: z.ZodType<string>, element: ReturnType<typeof buildElement>) {
  return z.object({
    id,
    kind: slideKindSchema,
    layoutId: z.string().optional(),
    background: fillSchema.optional(),
    elements: z.array(element),
    notes: z.string().optional(),
    source: z
      .object({ by: z.enum(['ai', 'user', 'plugin']), pluginId: z.string().optional() })
      .optional()
  })
}
