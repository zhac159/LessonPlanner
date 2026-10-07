/**
 * Runtime validation for the Deck model (design/deck-model.md §2-3). Decks, ChangeSets and DeckOps cross
 * trust boundaries (AI output, IPC arguments, files on disk), so they are always parsed with these schemas.
 *
 * Two flavours share one definition:
 *  - strict   : persisted decks. Every slide/element must carry an `id`.
 *  - lenient  : ops coming from the AI. A missing slide/element `id` is filled with a fresh one
 *               (design/deck-model.md §3: "give new elements ids if they're missing").
 * Diagram SVG is passed through the sanitiser in both flavours.
 */
import { z } from 'zod'
import { newId } from '../ids'
import { fail, ok, type Failure, type Success } from '../result'
import {
  buildElement,
  buildSlide,
  fillSchema,
  lessonMetaSchema,
  nonEmpty,
  slideKindSchema
} from './schemaParts'
import type { ChangeSet, Deck, DeckOp, Element, Slide } from './types'

export {
  SLIDE_KINDS,
  colorValueSchema,
  fillSchema,
  lessonMetaSchema,
  paragraphSchema,
  runSchema,
  slideKindSchema,
  strokeSchema
} from './schemaParts'

const lenientElement = buildElement(nonEmpty.default(() => newId('el')))

export const elementSchema = buildElement(nonEmpty)
export const slideSchema = buildSlide(nonEmpty, elementSchema)

/** Slides from the AI: missing ids are generated (`sld_…` for slides, `el_…` for elements). */
const lenientSlideSchema = buildSlide(
  nonEmpty.default(() => newId('sld')),
  lenientElement
)

export const deckSchema = z.object({
  schemaVersion: z.literal(1),
  id: nonEmpty,
  title: z.string(),
  meta: lessonMetaSchema,
  styleId: z.string().nullable(),
  styleVersion: z.number().int().nullable(),
  size: z.object({ width: z.literal(1920), height: z.literal(1080) }),
  slides: z.array(slideSchema),
  createdAt: z.string(),
  updatedAt: z.string()
})

// ---- operations -------------------------------------------------------------------------------

const slideIdOrStart = z.string().min(1).nullable()

/** `set` of updateElement: a plain object that never changes `id` or `type`. */
const elementPatchSchema = z.custom<Partial<Element>>(
  (v) => typeof v === 'object' && v !== null && !Array.isArray(v) && !('id' in v) && !('type' in v),
  'updateElement.set must be an object and must not contain "id" or "type"'
)

export const deckOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('insertSlides'),
    afterSlideId: slideIdOrStart,
    slides: z.array(lenientSlideSchema).min(1)
  }),
  z.object({ op: z.literal('deleteSlides'), slideIds: z.array(nonEmpty).min(1) }),
  z.object({ op: z.literal('moveSlide'), slideId: nonEmpty, afterSlideId: slideIdOrStart }),
  z.object({ op: z.literal('replaceSlide'), slide: buildSlide(nonEmpty, lenientElement) }),
  z.object({
    op: z.literal('updateSlide'),
    slideId: nonEmpty,
    set: z
      .object({
        kind: slideKindSchema,
        layoutId: z.string(),
        background: fillSchema,
        notes: z.string()
      })
      .partial()
  }),
  z.object({ op: z.literal('addElement'), slideId: nonEmpty, element: lenientElement }),
  z.object({
    op: z.literal('updateElement'),
    slideId: nonEmpty,
    elementId: nonEmpty,
    set: elementPatchSchema
  }),
  z.object({ op: z.literal('removeElement'), slideId: nonEmpty, elementId: nonEmpty }),
  z.object({
    op: z.literal('setMeta'),
    title: z.string().optional(),
    meta: lessonMetaSchema.partial().optional()
  })
])

export const changeSetSchema = z.object({
  id: nonEmpty,
  by: z.enum(['user', 'ai', 'plugin']),
  pluginId: z.string().optional(),
  summary: z.string(),
  ops: z.array(deckOpSchema),
  at: z.string()
})

// ---- compile-time contract: schemas and src/shared/deck/types.ts must agree both ways -----------

type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
const assertMutual = <A, B>(_ok: Mutual<A, B>): void => {}
assertMutual<z.infer<typeof deckSchema>, Deck>(true)
assertMutual<z.infer<typeof elementSchema>, Element>(true)
assertMutual<z.infer<typeof slideSchema>, Slide>(true)
assertMutual<z.infer<typeof deckOpSchema>, DeckOp>(true)
assertMutual<z.infer<typeof changeSetSchema>, ChangeSet>(true)

// ---- Result-style entry points ----------------------------------------------------------------

/** Readable one-line issues: `slides.2.elements.0.x: Invalid input`. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.')
    return path ? `${path}: ${issue.message}` : issue.message
  })
}

export type ParseResult<T> = Success<{ value: T }> | (Failure & { errors: string[] })

function run<T>(schema: z.ZodType<T>, input: unknown, what: string): ParseResult<T> {
  const parsed = schema.safeParse(input)
  if (parsed.success) return ok({ value: parsed.data })
  const errors = formatIssues(parsed.error)
  return { ...fail('invalid-input', `Invalid ${what}: ${errors[0] ?? 'unknown error'}`), errors }
}

/** Validate an untrusted value as a Deck (strict: every id must be present). */
export const parseDeck = (input: unknown): ParseResult<Deck> => run(deckSchema, input, 'deck')

/** Validate an untrusted ChangeSet. Missing slide/element ids inside ops are generated. */
export const parseChangeSet = (input: unknown): ParseResult<ChangeSet> =>
  run(changeSetSchema, input, 'change set')

/** Validate an untrusted array of operations (the AI's `ops`). */
export const parseDeckOps = (input: unknown): ParseResult<DeckOp[]> =>
  run(z.array(deckOpSchema), input, 'operations')
