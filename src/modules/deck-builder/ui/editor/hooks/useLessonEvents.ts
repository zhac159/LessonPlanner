import { useCallback, useEffect, useRef, useState } from 'react'
import { DECK_BUILDER, type DeckBuilderEvents } from '@shared/contracts/deck-builder'
import { useEvent } from '@renderer/sdk'
import { changedSlideIds } from '../logic/changedSlides'

/** How long a freshly added slide flashes in the filmstrip (06 §7). */
export const FLASH_MS = 1000

export interface LessonEvents {
  /** An AI job (chat turn or plugin) is running; generation is tracked separately. */
  chatBusy: boolean
  /** Slides that just landed from the AI, flashing for a moment. */
  flashIds: string[]
}

/**
 * Chat and plugin activity on this lesson: a committed ChangeSet re-reads the deck (`onChanged`) and flashes the new
 * slides; `chat:status` marks a job as running until `chat:done` or an error ends it (06 §7, §8.9).
 */
export function useLessonEvents(
  lessonId: string,
  startedBusy: boolean,
  onChanged: () => Promise<void>
): LessonEvents {
  const [chatBusy, setChatBusy] = useState(startedBusy)
  const [flashIds, setFlashIds] = useState<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (startedBusy) setChatBusy(true)
  }, [startedBusy])

  const flash = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    clearTimeout(timer.current)
    setFlashIds(ids)
    timer.current = setTimeout(() => setFlashIds([]), FLASH_MS)
  }, [])

  useEvent<DeckBuilderEvents, 'chat:changes'>(DECK_BUILDER, 'chat:changes', (event) => {
    if (event.lessonId !== lessonId) return
    void onChanged().then(() => flash(changedSlideIds(event.changeSet)))
  })
  useEvent<DeckBuilderEvents, 'chat:status'>(DECK_BUILDER, 'chat:status', (event) => {
    if (event.lessonId === lessonId && event.state === 'running') setChatBusy(true)
  })
  useEvent<DeckBuilderEvents, 'chat:done'>(DECK_BUILDER, 'chat:done', (event) => {
    if (event.lessonId === lessonId) setChatBusy(false)
  })
  useEvent<DeckBuilderEvents, 'ai:error'>(DECK_BUILDER, 'ai:error', () => setChatBusy(false))

  return { chatBusy, flashIds }
}
