import { useCallback, useState } from 'react'
import type { HistoryState } from '@shared/contracts/deck-builder'
import type { SessionContext } from './session'

/** Undo is only allowed on the latest change, Redo only on the next one to redo (06 §8.6). Unknown history allows both. */
export const canUndoChange = (history: HistoryState | null, changeSetId: string): boolean =>
  history === null || history.undoChangeSetId === changeSetId

export const canRedoChange = (history: HistoryState | null, changeSetId: string): boolean =>
  history === null || history.redoChangeSetId === changeSetId

const FAILED = 'Couldn’t do that. Try again.'

/** Undo and Redo on a ResultChip, through the editor contract; the editor gets the new deck and history. */
export function useResultActions(ctx: SessionContext) {
  const { client, lessonId, dispatch, commit, toast } = ctx
  const [busyId, setBusyId] = useState<string | null>(null)

  const step = useCallback(
    async (direction: 'undo' | 'redo', changeSetId: string): Promise<void> => {
      setBusyId(changeSetId)
      try {
        const result =
          direction === 'undo' ? await client.undo({ lessonId }) : await client.redo({ lessonId })
        if (result.ok) {
          dispatch({ type: 'set-undone', changeSetId, undone: direction === 'undo' })
          commit({ deck: result.deck, history: result.history })
        } else {
          toast.show({ message: result.message, tone: 'error' })
        }
      } catch {
        toast.show({ message: FAILED, tone: 'error' })
      } finally {
        setBusyId(null)
      }
    },
    [client, lessonId, dispatch, commit, toast]
  )

  return {
    busyId,
    undo: (changeSetId: string) => step('undo', changeSetId),
    redo: (changeSetId: string) => step('redo', changeSetId)
  }
}
