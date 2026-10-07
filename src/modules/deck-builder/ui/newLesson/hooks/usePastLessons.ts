import { useCallback, useEffect, useRef, useState } from 'react'
import { useClient } from '@renderer/sdk'
import {
  DECK_BUILDER,
  type DeckBuilderApi,
  type LessonSummary
} from '@shared/contracts/deck-builder'

export const COPY_FAILED = 'I couldn’t copy that lesson. Try again.'
export const LIST_FAILED = 'I couldn’t load your lessons.'

export interface PastLessonsState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Lessons that can be copied (damaged ones are left out). */
  lessons: LessonSummary[]
  /** The copy is being made. */
  copying: boolean
  error: string | null
  /** Copies a lesson (`duplicateLesson`); `onCopied` gets the new lesson's id. */
  use(lessonId: string, onCopied: (lessonId: string) => void): Promise<void>
}

/** The lessons the teacher can start from, loaded when the dialog opens (05 §8.9). */
export function usePastLessons(open: boolean): PastLessonsState {
  const deckBuilder = useClient<DeckBuilderApi>(DECK_BUILDER)
  const [status, setStatus] = useState<PastLessonsState['status']>('idle')
  const [lessons, setLessons] = useState<LessonSummary[]>([])
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copyingRef = useRef(false)

  useEffect(() => {
    if (!open) return
    let live = true
    setStatus('loading')
    setError(null)
    deckBuilder
      .listLessons()
      .then((list) => {
        if (!live) return
        setLessons(list.filter((lesson) => !lesson.damaged))
        setStatus('ready')
      })
      .catch(() => live && setStatus('error'))
    return () => {
      live = false
    }
  }, [open, deckBuilder])

  const use = useCallback(
    async (lessonId: string, onCopied: (lessonId: string) => void) => {
      if (copyingRef.current) return
      copyingRef.current = true
      setCopying(true)
      setError(null)
      try {
        const copy = await deckBuilder.duplicateLesson({ lessonId })
        if (copy.ok) onCopied(copy.lesson.id)
        else setError(copy.message)
      } catch {
        setError(COPY_FAILED)
      } finally {
        copyingRef.current = false
        setCopying(false)
      }
    },
    [deckBuilder]
  )

  return { status, lessons, copying, error, use }
}
