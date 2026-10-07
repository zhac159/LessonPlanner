/**
 * Turns what the teacher set up on the New lesson screen into the `createLesson` request (05 §6), and
 * decides whether it can be sent. Pure TypeScript: no React.
 */
import type { CreateLessonRequest, LoDocument } from '@shared/contracts/deck-builder'
import type { LessonMeta } from '@shared/deck/types'
import type { LessonSetup } from './setup'

/** Documents that can be attached to one lesson (05 §8.5). */
export const MAX_DOCUMENTS = 3
/** The title field's limit (05 §8.6). */
export const MAX_TITLE_LENGTH = 80
/** Above this the Composer shows the "attach the document instead" hint (05 §7). */
export const LONG_TEXT_CHARS = 20_000

export const NEEDS_OBJECTIVES = 'Add your learning objectives, or attach a document, first.'
export const LONG_TEXT_HINT = 'That’s a lot of text. Attaching the document may work better.'

/** An attached document and how reading it went. */
export interface DraftDocument extends LoDocument {
  status: 'reading' | 'ready' | 'error'
  /** "3 objectives found" once Claude has read it. */
  detail?: string
}

/** Everything on the screen that goes into a new lesson. */
export interface LessonDraft {
  text: string
  /** The header title as typed; empty means "let the plan name it". */
  title: string
  documents: ReadonlyArray<DraftDocument>
  /** Null is the built-in plain style. */
  styleId: string | null
  setup: LessonSetup
}

/** The lesson facts Claude and the editor use (05 §6 `meta`). */
export function buildMeta(setup: LessonSetup): Partial<LessonMeta> {
  return {
    ...(setup.yearGroup ? { yearGroup: setup.yearGroup } : {}),
    durationMin: setup.durationMin,
    ability: setup.ability,
    targetSlideCount: setup.slideCount
  }
}

/** Documents Claude may still use: the ones that could not be read stay out of the request. */
export const usableDocuments = (draft: LessonDraft): DraftDocument[] =>
  draft.documents.filter((doc) => doc.status !== 'error')

/** Is there anything to plan from? Text or at least one readable document. */
export const hasObjectives = (draft: LessonDraft): boolean =>
  draft.text.trim() !== '' || usableDocuments(draft).length > 0

/** Why "Make my slides" cannot go ahead yet, or null. */
export function validateDraft(draft: LessonDraft): string | null {
  return hasObjectives(draft) ? null : NEEDS_OBJECTIVES
}

/** True for a very long paste (05 §7). */
export const isLongText = (text: string): boolean => text.length > LONG_TEXT_CHARS

/** The `createLesson` request for "Make my slides" or "Blank slide". */
export function buildCreateRequest(
  draft: LessonDraft,
  kind: 'generate' | 'blank'
): CreateLessonRequest {
  const title = draft.title.trim()
  const generate = kind === 'generate'
  return {
    objectivesText: generate ? draft.text.trim() : '',
    documentIds: usableDocuments(draft).map((doc) => doc.id),
    styleId: draft.styleId,
    title: title === '' ? null : title.slice(0, MAX_TITLE_LENGTH),
    meta: buildMeta(draft.setup),
    startGeneration: generate,
    ...(generate ? {} : { blankSlide: true })
  }
}
