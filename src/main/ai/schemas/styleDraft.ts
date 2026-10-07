/**
 * What Claude writes when it learns a style (the "draft"): the wire schema, with no optional fields and no open
 * maps (colours and components are arrays keyed by name). Mapping to a real StyleProfile is in style.ts.
 */
import { z } from 'zod'
import { SLIDE_KINDS } from '@shared/style/schema'
import { slideWire } from './slide'

const slideKind = z.enum(SLIDE_KINDS)
const level = z.enum(['low', 'medium', 'high'])

export const colourDraft = z.object({
  token: z
    .string()
    .describe(
      'background, text, accent, accent2, highlight, chipBg, chipText, muted, placeholder...'
    ),
  hex: z.string().describe('#RRGGBB'),
  label: z.string(),
  usage: z.string().describe('when she uses it')
})

export const fontDraft = z.object({
  family: z.string().describe('"" when this font slot is not used'),
  weight: z.number().describe('400, 500, 600, 700 or 800'),
  sizePt: z.number(),
  sizeMinPt: z.number().describe('0 when there is no range'),
  sizeMaxPt: z.number().describe('0 when there is no range'),
  fallbackStack: z.string().describe('CSS stack or ""')
})

export const componentDraft = z.object({
  key: z
    .string()
    .describe('"title", "kicker", "chip", "callout.mini-whiteboard", "decoration.leftBand"...'),
  description: z.string(),
  font: z.enum(['title', 'body', 'accent', 'none']),
  sizePt: z.number().describe('0 = inherit'),
  bold: z.boolean(),
  color: z.string().describe('"token:..." / "#hex" / ""'),
  fill: z.string().describe('"token:..." / "#hex" / ""'),
  radius: z.number(),
  uppercase: z.boolean(),
  letterSpacingEm: z.number(),
  rules: z.array(z.string())
})

export const regionDraft = z.object({
  name: z.string(),
  elementType: z.enum(['text', 'chips', 'callout', 'image', 'diagram', 'shape', 'table']),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  styleRef: z.string().describe('component key or ""'),
  optional: z.boolean()
})

export const layoutDraft = z.object({
  id: z.string().describe('kebab-case, unique'),
  name: z.string(),
  usedFor: z.array(slideKind),
  regions: z.array(regionDraft),
  decorations: z.array(z.string()).describe('component keys always drawn')
})

export const slideTypeDraft = z.object({
  kind: slideKind,
  name: z.string(),
  frequency: z.enum(['always', 'often', 'sometimes']),
  description: z.string(),
  typicalPosition: z.enum(['start', 'middle', 'end', 'repeated', 'none']),
  exampleText: z.string().describe('or ""')
})

export const voiceDraft = z.object({
  spelling: z.enum(['en-GB', 'en-US']),
  readingAge: z.string().describe('or ""'),
  rules: z.array(z.string()),
  phrases: z.array(z.string()),
  questionStyle: z.string().describe('or ""')
})

/**
 * The style is learned in TWO calls because the structured-output endpoint refuses a grammar this large in one
 * ("compiled grammar is too large"): first everything but the layouts, then the layouts and the test slide
 * (which needs both).
 */
export const styleCore = z.object({
  colors: z.array(colourDraft),
  fonts: z.object({ title: fontDraft, body: fontDraft, accent: fontDraft }),
  components: z.array(componentDraft),
  slideTypes: z.array(slideTypeDraft),
  lessonFlow: z.array(slideKind),
  voice: voiceDraft,
  habits: z.array(z.string()),
  confidence: z.object({
    colors: level,
    fonts: level,
    layouts: level,
    voice: level,
    slideTypes: level
  })
})

export const styleLayouts = z.object({
  layouts: z.array(layoutDraft),
  testSlide: slideWire
})

/** Both halves together: the shape `draftToProfile` maps to a `StyleProfile`. */
export const styleDraft = z.object({ ...styleCore.shape, ...styleLayouts.shape })

export type StyleDraft = z.infer<typeof styleDraft>
