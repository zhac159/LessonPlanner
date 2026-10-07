import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import {
  DECK_BUILDER,
  type DeckBuilderApi,
  type DeckBuilderEvents,
  type LessonSummary
} from '@shared/contracts/deck-builder'

export interface LessonsState {
  /** `loading` until the first answer; `error` only when there is nothing to show. */
  status: 'loading' | 'ready' | 'error'
  lessons: LessonSummary[]
  /** Reads the list again (called by "Try again"). */
  reload(): Promise<void>
  /** Optimistic local edits (a rename, a delete); the next `lessonsChanged` event replaces them. */
  setLessons: Dispatch<SetStateAction<LessonSummary[]>>
}

/**
 * The saved lessons, kept current: loaded on mount, again each time Home becomes visible and
 * whenever main pushes `lessonsChanged` (a duplicate, a rename, a generation finishing).
 */
export function useLessons(active: boolean): LessonsState {
  const deckBuilder = useClient<DeckBuilderApi>(DECK_BUILDER)
  const [status, setStatus] = useState<LessonsState['status']>('loading')
  const [lessons, setLessons] = useState<LessonSummary[]>([])
  const loadedOnce = useRef(false)

  const reload = useCallback(async () => {
    try {
      const list = await deckBuilder.listLessons()
      loadedOnce.current = true
      setLessons(list)
      setStatus('ready')
    } catch {
      // A failed refresh keeps what is on screen; only a first load shows the error.
      if (!loadedOnce.current) setStatus('error')
    }
  }, [deckBuilder])

  useEffect(() => {
    if (active) void reload()
  }, [active, reload])

  useEvent<DeckBuilderEvents, 'lessonsChanged'>(DECK_BUILDER, 'lessonsChanged', (list) => {
    loadedOnce.current = true
    setLessons(list)
    setStatus('ready')
  })

  return { status, lessons, reload, setLessons }
}
