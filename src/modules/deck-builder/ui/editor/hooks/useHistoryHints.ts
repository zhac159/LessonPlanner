import { useEffect, type RefObject } from 'react'
import type { HistoryState } from '@shared/contracts/deck-builder'

/** What Undo and Redo would do, in a sentence for screen readers: "Undo: Moved a slide". Empty when they cannot. */
export function historyHints(history: HistoryState): { undo: string; redo: string } {
  return {
    undo: history.canUndo && history.undoSummary ? `Undoes: ${history.undoSummary}` : '',
    redo: history.canRedo && history.redoSummary ? `Redoes: ${history.redoSummary}` : ''
  }
}

/**
 * Tells the Undo and Redo buttons of the ToolRail what they would change (`aria-description`), from the summaries of
 * the history (06 §3). The kit's buttons only know their fixed names, so the screen adds the description by `data-id`.
 */
export function useHistoryHints(rail: RefObject<HTMLElement | null>, history: HistoryState): void {
  const { undo, redo } = historyHints(history)
  useEffect(() => {
    const root = rail.current
    if (!root) return
    const set = (id: string, text: string): void => {
      const button = root.querySelector<HTMLElement>(`button[data-id="${id}"]`)
      if (!button) return
      if (text) button.setAttribute('aria-description', text)
      else button.removeAttribute('aria-description')
    }
    set('undo', undo)
    set('redo', redo)
  }, [rail, undo, redo])
}
