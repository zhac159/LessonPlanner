import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DECK_BUILDER,
  type EditorApi,
  type HistoryState,
  type LessonView
} from '@shared/contracts/deck-builder'
import type { Deck } from '@shared/deck/types'
import { useClient } from '@renderer/sdk'

/** The deck and the Undo/Redo state: the two things every edit changes together. */
export interface LessonSnapshot {
  deck: Deck
  history: HistoryState
}

export type LessonLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; view: LessonView }

export interface UseLesson {
  load: LessonLoad
  /** The current deck and history (null until the lesson opened). */
  snapshot: LessonSnapshot | null
  /** The latest snapshot, readable synchronously (for queued edits). */
  latest: { current: LessonSnapshot | null }
  /** Title and style as last read (the deck can change without them). */
  style: LessonView['style'] | null
  /** Takes the result of an edit, undo or redo. */
  commit(next: LessonSnapshot): void
  /** Re-reads deck, history and style from main (after chat, plugin or generation changes). */
  refresh(): Promise<void>
}

/**
 * Opens a lesson and keeps its deck and history current (06 §6). Main is the source of truth: results of edits go
 * through `commit`, and `refresh` re-reads after anything the editor did not do itself. Replies that arrive out of
 * order never overwrite a newer one.
 */
export function useLesson(lessonId: string, reloadToken = 0): UseLesson {
  const client = useClient<EditorApi>(DECK_BUILDER)
  const [load, setLoad] = useState<LessonLoad>({ status: 'loading' })
  const [snapshot, setSnapshot] = useState<LessonSnapshot | null>(null)
  const [style, setStyle] = useState<LessonView['style'] | null>(null)
  const latest = useRef<LessonSnapshot | null>(null)
  const issued = useRef(0)
  const applied = useRef(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const adopt = useCallback((next: LessonSnapshot) => {
    latest.current = next
    setSnapshot(next)
  }, [])

  useEffect(() => {
    let current = true
    issued.current += 1
    const mine = issued.current
    setLoad((was) => (was.status === 'ready' ? was : { status: 'loading' }))
    client
      .openLesson({ lessonId })
      .then((result) => {
        if (!current) return
        if (!result.ok) {
          setLoad({ status: 'error', message: result.message })
          return
        }
        const view: LessonView = result
        applied.current = Math.max(applied.current, mine)
        adopt({ deck: view.deck, history: view.history })
        setStyle(view.style)
        setLoad({ status: 'ready', view })
      })
      .catch((error: unknown) => {
        if (current) setLoad({ status: 'error', message: String(error) })
      })
    return () => {
      current = false
    }
  }, [client, lessonId, reloadToken, adopt])

  const commit = useCallback(
    (next: LessonSnapshot) => {
      issued.current += 1
      applied.current = issued.current
      adopt(next)
    },
    [adopt]
  )

  const refresh = useCallback(async () => {
    issued.current += 1
    const mine = issued.current
    try {
      const result = await client.openLesson({ lessonId })
      if (!alive.current || !result.ok || mine < applied.current) return
      applied.current = mine
      adopt({ deck: result.deck, history: result.history })
      setStyle(result.style)
    } catch {
      // The next event or edit reads again; a failed read must not break the screen.
    }
  }, [client, lessonId, adopt])

  return { load, snapshot, latest, style, commit, refresh }
}
