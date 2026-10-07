/** New decks: an empty lesson and the single blank slide of "Blank slide" (05 §8.10). Pure. */
import type { Deck, LessonMeta, Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { buildTextSlide } from '@shared/plugins/slides'

export const UNTITLED = 'Untitled lesson'
export const MAX_TITLE_LENGTH = 80

/** A deck with no slides yet. */
export function newDeck(input: {
  id: string
  title: string
  meta: Partial<LessonMeta>
  style: StyleProfile | null
  now: Date
}): Deck {
  const at = input.now.toISOString()
  return {
    schemaVersion: 1,
    id: input.id,
    title: input.title,
    meta: { ...input.meta, objectives: input.meta.objectives ?? [] },
    styleId: input.style?.id ?? null,
    styleVersion: input.style?.version ?? null,
    size: { width: 1920, height: 1080 },
    slides: [],
    createdAt: at,
    updatedAt: at
  }
}

/** One empty slide on the style's title layout (a plain title box without a style). */
export function blankSlide(id: string, style: StyleProfile | null): Slide {
  return buildTextSlide({ id, kind: 'title', title: '', body: [{ runs: [{ text: '' }] }] }, style, {
    slides: []
  })
}

/** Trims and checks a lesson title: 1 to 80 characters. */
export function cleanTitle(title: string): string | null {
  const text = title.replace(/\s+/g, ' ').trim()
  return text && text.length <= MAX_TITLE_LENGTH ? text : null
}
