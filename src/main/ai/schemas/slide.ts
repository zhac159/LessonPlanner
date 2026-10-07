/**
 * What Claude writes for ONE slide (the "wire" shape) and the mapper to the real `Slide`.
 *
 * Structured outputs reject open maps and have schema-complexity limits, so the wire shape has no optional
 * fields: every field is required and "not set" is "" / 0 / false. The mapper strips those, assigns element ids
 * (the model never invents ids, so they cannot clash), snaps boxes inside 1920x1080 and drops invalid colours.
 */
import { z } from 'zod'
import { slideSchema } from '@shared/deck/schema'
import { sanitiseSvg } from '@shared/deck/svg'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@shared/deck/types'
import type { ColorValue, Element, Paragraph, Run, Slide, SlideKind } from '@shared/deck/types'
import { SLIDE_KINDS } from '@shared/style/schema'
import { aiError } from '../aiError'
import { tailOf, toImage, type SlideAssets } from './slideImage'

export type { SlideAssets } from './slideImage'

const colour = z.string().describe('"token:accent", "#RRGGBB", or "" for the default')

const runWire = z.object({
  text: z.string(),
  bold: z.boolean(),
  italic: z.boolean(),
  color: colour
})
const paragraphWire = z.object({
  runs: z.array(runWire),
  list: z.enum(['none', 'bullet', 'number', 'checkbox']),
  level: z.number().int().describe('0, 1 or 2')
})

/**
 * ONE flat element shape for every element type. The structured-output endpoint rejects a union of seven object
 * types here ("compiled grammar is too large"); a single object with a `type` discriminator compiles. Only the
 * fields of the chosen `type` matter; the others are "" / 0 / false / [] and are ignored by `toElement`.
 */
export const elementWire = z.object({
  type: z.enum(['text', 'chips', 'callout', 'image', 'diagram', 'shape', 'table']),
  name: z.string().describe('short label such as "photo" or "objectives list"'),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  locked: z.boolean().describe('true for style decorations'),
  styleRef: z.string().describe('component key from the style profile, or ""'),
  role: z
    .enum(['title', 'kicker', 'subtitle', 'heading', 'body', 'caption', 'label', 'none'])
    .describe('text only; "none" for every other type'),
  paragraphs: z.array(paragraphWire).describe('text and callout only, else []'),
  align: z.enum(['left', 'center', 'right']),
  valign: z.enum(['top', 'middle', 'bottom']),
  fontSizePt: z.number().describe('text only; 0 = use the style default'),
  items: z.array(z.string()).describe('chips only, else []'),
  variant: z.string().describe('callout only, e.g. "mini-whiteboard", "do-now", "warning"'),
  label: z.string().describe('callout only: bold label or ""'),
  description: z.string().describe('image only: what the photo should show (placeholder text)'),
  alt: z.string().describe('image and diagram: alt text'),
  fit: z.enum(['cover', 'contain']),
  radius: z.number().describe('image and shape corner radius, 0 = none'),
  svg: z.string().describe('diagram only: self-contained SVG, no scripts'),
  shape: z.enum(['rect', 'roundRect', 'ellipse', 'line', 'arrow']).describe('shape only'),
  fill: colour.describe('shape only: "token:accent", "#RRGGBB" or ""'),
  strokeColor: colour.describe('shape only'),
  strokeWidth: z.number().describe('shape only; 0 = no outline'),
  rows: z.array(z.array(z.string())).describe('table only, else []'),
  headerRow: z.boolean().describe('table only')
})

const slideFields = {
  kind: z.enum(SLIDE_KINDS),
  layoutId: z.string().describe('layout id from the style profile, or ""'),
  background: colour,
  notes: z.string().describe('speaker notes, 2-4 sentences')
}

/** The slide shape the style learner writes its test slide in (kept small: that call is the biggest one). */
export const slideWire = z.object({ ...slideFields, elements: z.array(elementWire) })

/**
 * What `extras` add for the lesson writer: her assets by name, picture-spot hints and the speech-bubble tail. Four
 * flat strings; kept OUT of `slideWire` so the style synthesis grammar does not grow.
 */
const writerExtras = {
  assetName: z
    .string()
    .describe('image only: the exact name of one of her assets to place here, or "" for none'),
  spotKind: z
    .string()
    .describe(
      'image spot only: logo, icon, picture, photo, diagram, banner, character, symbol-card or ""'
    ),
  spotQuery: z.string().describe('image spot only: 2-5 search words, or ""'),
  tail: z
    .string()
    .describe(
      'speech-bubble callout only: bottom-left, bottom-right, top-left, top-right, left, right, none or ""'
    )
}

/** The slide shape `writeSlide` asks for. */
export const writerSlideWire = z.object({
  ...slideFields,
  elements: z.array(elementWire.extend(writerExtras))
})

export type SlideWire = z.infer<typeof slideWire>
export type WriterSlideWire = z.infer<typeof writerSlideWire>
export type ElementWire = z.infer<typeof elementWire> &
  Partial<z.infer<z.ZodObject<typeof writerExtras>>>
export type ElementBase = Pick<
  Element,
  'id' | 'x' | 'y' | 'w' | 'h' | 'locked' | 'styleRef' | 'name'
>

const COLOUR = /^(token:[A-Za-z0-9_.-]+|#[0-9A-Fa-f]{3,8})$/

/** A valid colour value or undefined (so a model slip never reaches the deck as garbage). */
export function toColour(value: string): ColorValue | undefined {
  return COLOUR.test(value) ? (value as ColorValue) : undefined
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))

function toRun(run: z.infer<typeof runWire>): Run {
  const color = toColour(run.color)
  return {
    text: run.text,
    ...(run.bold ? { bold: true } : {}),
    ...(run.italic ? { italic: true } : {}),
    ...(color ? { color } : {})
  }
}

function toParagraph(paragraph: z.infer<typeof paragraphWire>): Paragraph {
  return {
    runs: paragraph.runs.map(toRun),
    ...(paragraph.list === 'none' ? {} : { list: paragraph.list }),
    ...(paragraph.level > 0 ? { level: clamp(Math.round(paragraph.level), 0, 2) as 0 | 1 | 2 } : {})
  }
}

function toElement(wire: ElementWire, id: string, assets?: SlideAssets): Element {
  const x = clamp(wire.x, 0, SLIDE_WIDTH - 1)
  const y = clamp(wire.y, 0, SLIDE_HEIGHT - 1)
  const base = {
    id,
    x,
    y,
    w: clamp(wire.w, 1, SLIDE_WIDTH - x),
    h: clamp(wire.h, 1, SLIDE_HEIGHT - y),
    ...(wire.locked ? { locked: true } : {}),
    ...(wire.styleRef ? { styleRef: wire.styleRef } : {}),
    ...(wire.name ? { name: wire.name } : {})
  }
  switch (wire.type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        role: wire.role === 'none' ? 'body' : wire.role,
        paragraphs: wire.paragraphs.map(toParagraph),
        align: wire.align,
        valign: wire.valign,
        ...(wire.fontSizePt > 0 ? { fontSizePt: wire.fontSizePt } : {})
      }
    case 'chips':
      return { ...base, type: 'chips', items: wire.items }
    case 'callout': {
      const tail = wire.variant === 'speech-bubble' ? tailOf(wire.tail ?? '') : undefined
      return {
        ...base,
        type: 'callout',
        variant: wire.variant,
        ...(wire.label ? { label: wire.label } : {}),
        paragraphs: wire.paragraphs.map(toParagraph),
        ...(tail ? { tail } : {})
      }
    }
    case 'image':
      return toImage(wire, base, assets)
    case 'diagram': {
      const svg = sanitiseSvg(wire.svg)
      // An unusable drawing becomes a photo placeholder in the same box rather than failing the whole slide.
      return svg.ok
        ? { ...base, type: 'diagram', svg: svg.svg, alt: wire.alt }
        : {
            ...base,
            type: 'image',
            fit: 'contain',
            alt: wire.alt,
            placeholder: { description: wire.alt || 'Diagram' }
          }
    }
    case 'shape': {
      const fill = toColour(wire.fill)
      const stroke = toColour(wire.strokeColor)
      return {
        ...base,
        type: 'shape',
        shape: wire.shape,
        ...(fill ? { fill: { color: fill } } : {}),
        ...(stroke && wire.strokeWidth > 0
          ? { stroke: { color: stroke, width: wire.strokeWidth } }
          : {}),
        ...(wire.radius > 0 ? { radius: wire.radius } : {})
      }
    }
    case 'table':
      return { ...base, type: 'table', rows: wire.rows, headerRow: wire.headerRow }
  }
}

/** Wire slide -> deck `Slide` with id `id` and elements `${id}-e1`, `${id}-e2`... */
export function toSlide(
  wire: SlideWire | WriterSlideWire,
  id: string,
  assets?: SlideAssets
): Slide {
  const background = toColour(wire.background)
  return {
    id,
    kind: wire.kind as SlideKind,
    ...(wire.layoutId ? { layoutId: wire.layoutId } : {}),
    ...(background ? { background: { color: background } } : {}),
    elements: wire.elements.map((element, i) => toElement(element, `${id}-e${i + 1}`, assets)),
    ...(wire.notes ? { notes: wire.notes } : {}),
    source: { by: 'ai' }
  }
}

/**
 * `toSlide` plus the shared deck schema as a last gate: whatever Claude wrote, only a slide the app itself would
 * accept leaves the AI layer (an invalid one fails the call with the generic `unknown` error).
 */
export function checkedSlide(
  wire: SlideWire | WriterSlideWire,
  id: string,
  assets?: SlideAssets
): Slide {
  const parsed = slideSchema.safeParse(toSlide(wire, id, assets))
  if (!parsed.success) {
    console.error('[ai] slide failed validation at', parsed.error.issues[0]?.path.join('.'))
    throw aiError('unknown')
  }
  return parsed.data
}
