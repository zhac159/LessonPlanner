/** Optional props the editor can pass on top of the agreed `EditorChatProps` seam. */
import type { ReactNode } from 'react'
import type { HistoryState } from '@shared/contracts/deck-builder'

export interface EditorChatExtras {
  /**
   * The editor's current Undo / Redo state. Without it the panel reads the history from main itself; with
   * it, Undo on a result chip stays correct after direct edits.
   */
  history?: HistoryState
  /** A deep link's text for the box (e.g. "{{Owl}} "): put there once per `key`, and the box takes focus. */
  composerRequest?: { text: string; key: number }
  /** Select a slide in the filmstrip: a result chip or a sent region chip was clicked. */
  onSelectSlide?(slideId: string): void
  /** A11 / A13: a sheet that takes the panel's place while it is open (the panel and its draft stay mounted). */
  sheet?: ReactNode
  /** The live count of empty picture spots, for the card under a message that left some (A12). */
  spots?: { count: number; onFillFirst(): void }
}
