/**
 * Where the deck-builder module goes for a shell navigation intent (03 §8, 05 §2, 06 §2). Pure.
 *
 *   { kind: 'new-lesson', title?, text?, composerText? }   the New lesson screen (05), optionally pre-filled
 *                                                  (`composerText`, sent by the Assets page, goes into the box)
 *   { kind: 'create-lesson', request | fields }    Home's quick card: create the lesson, then open it generating
 *   { kind: 'open-lesson', lessonId, composerText? }   the editor (06); `composerText` is put in the chat box
 */
import type { CreateLessonRequest } from '@shared/contracts/deck-builder'
import type { LessonMeta } from '@shared/deck/types'

export type Route =
  | { screen: 'new-lesson'; prefill?: { title?: string; text?: string } }
  | { screen: 'create-lesson'; request: CreateLessonRequest }
  | { screen: 'editor'; lessonId: string; composerText?: string }

export interface IntentLike {
  kind: string
  [key: string]: unknown
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

function createRequest(intent: IntentLike): CreateLessonRequest {
  const source = record(intent.request) ?? intent
  const documentIds = Array.isArray(source.documentIds)
    ? source.documentIds.filter((id): id is string => typeof id === 'string')
    : []
  const meta = (record(source.meta) ?? {}) as Partial<LessonMeta>
  return {
    objectivesText: typeof source.objectivesText === 'string' ? source.objectivesText : '',
    documentIds,
    styleId: typeof source.styleId === 'string' ? source.styleId : null,
    title: text(source.title) ?? null,
    meta,
    startGeneration: true
  }
}

/** The route an intent asks for, or null when the intent is not one of ours. */
export function routeForIntent(intent: IntentLike): Route | null {
  switch (intent.kind) {
    case 'new-lesson': {
      const source = record(intent.prefill) ?? intent
      const title = text(source.title)
      const body =
        [text(source.text), text(intent.composerText)].filter(Boolean).join(' ') || undefined
      return { screen: 'new-lesson', ...(title || body ? { prefill: { title, text: body } } : {}) }
    }
    case 'create-lesson':
      return { screen: 'create-lesson', request: createRequest(intent) }
    case 'open-lesson': {
      const lessonId = text(intent.lessonId)
      const composerText = text(intent.composerText)
      return lessonId
        ? { screen: 'editor', lessonId, ...(composerText ? { composerText } : {}) }
        : null
    }
    default:
      return null
  }
}
