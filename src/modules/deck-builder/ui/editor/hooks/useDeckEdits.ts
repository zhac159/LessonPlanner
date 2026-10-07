import { useCallback, useRef } from 'react'
import { DECK_BUILDER, type EditorApi, type LessonsApi } from '@shared/contracts/deck-builder'
import { applyChangeSet } from '@shared/deck/apply'
import { useClient } from '@renderer/sdk'
import { useToast } from '@ui/overlays'
import type { Deck } from '@shared/deck/types'
import type { EditPlan } from '../logic/changes'
import type { UseLesson } from './useLesson'

/** An edit, or a function that makes it from the deck as it is when its turn comes (for repeated keys). */
export type PlanSource = EditPlan | ((deck: Deck) => EditPlan | null)

export interface DeckEdits {
  /** One direct edit = one ChangeSet = one undo step. Resolves true when it was applied. */
  apply(plan: PlanSource): Promise<boolean>
  undo(): Promise<void>
  redo(): Promise<void>
  /** Renames the lesson (a setMeta ChangeSet made by main). Resolves true when saved. */
  rename(title: string): Promise<boolean>
}

type LessonSource = Pick<UseLesson, 'latest' | 'commit' | 'refresh'>

/**
 * The teacher's edits, undo and redo (06 §8.3). Calls run one after another, so quick edits (nudging with the arrow
 * keys) apply in order, each on top of the deck the previous one produced. A failure is told in a toast and leaves
 * the deck as it was.
 */
export function useDeckEdits(lessonId: string, lesson: LessonSource): DeckEdits {
  const client = useClient<EditorApi & LessonsApi>(DECK_BUILDER)
  const toast = useToast()
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const { latest, commit, refresh } = lesson

  const enqueue = useCallback(<T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(task, task)
    queue.current = next.catch(() => undefined)
    return next
  }, [])

  const fail = useCallback((message: string) => toast.show({ message, tone: 'error' }), [toast])

  const apply = useCallback(
    (source: PlanSource) =>
      enqueue(async () => {
        const plan =
          typeof source === 'function' ? latest.current && source(latest.current.deck) : source
        if (!plan) return false
        try {
          const result = await client.applyOps({ lessonId, ops: plan.ops, summary: plan.summary })
          if (!result.ok) {
            fail(result.message)
            return false
          }
          const deck = latest.current?.deck
          const local = deck ? applyChangeSet(deck, result.changeSet, { allowLocked: true }) : null
          if (local?.ok) commit({ deck: local.deck, history: result.history })
          else await refresh()
          return true
        } catch {
          fail('Couldn’t make that change. Nothing was changed.')
          return false
        }
      }),
    [client, lessonId, latest, commit, refresh, fail, enqueue]
  )

  const step = useCallback(
    (direction: 'undo' | 'redo') =>
      enqueue(async () => {
        try {
          const result = await client[direction]({ lessonId })
          if (!result.ok) fail(result.message)
          else commit({ deck: result.deck, history: result.history })
        } catch {
          fail(`Couldn’t ${direction} that. Nothing was changed.`)
        }
      }),
    [client, lessonId, commit, fail, enqueue]
  )

  const rename = useCallback(
    (title: string) =>
      enqueue(async () => {
        try {
          const result = await client.renameLesson({ lessonId, title })
          if (!result.ok) {
            fail(result.message)
            return false
          }
          await refresh()
          return true
        } catch {
          fail('Couldn’t rename the lesson.')
          return false
        }
      }),
    [client, lessonId, refresh, fail, enqueue]
  )

  const undo = useCallback(() => step('undo'), [step])
  const redo = useCallback(() => step('redo'), [step])
  return { apply, undo, redo, rename }
}
