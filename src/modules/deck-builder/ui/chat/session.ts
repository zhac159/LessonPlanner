/** What the chat session's helper hooks share. Types only. */
import type { MutableRefObject } from 'react'
import type { ContractClient } from '@shared/contract'
import type { DeckBuilderApi, HistoryState, LessonView } from '@shared/contracts/deck-builder'
import type { Deck } from '@shared/deck/types'
import type { ToastApi } from '@ui/overlays'
import type { TranscriptAction, TranscriptState } from './transcriptState'

export type DeckBuilderClient = ContractClient<DeckBuilderApi>

export interface SessionContext {
  client: DeckBuilderClient
  lessonId: string
  dispatch(action: TranscriptAction): void
  getState(): TranscriptState
  /** The newest deck this panel knows (props, or what a chat change just produced). */
  deckRef: MutableRefObject<Deck>
  /** A new deck and history came from a turn, an undo or a re-read: remember them and tell the editor. */
  commit(view: { deck: Deck; history: HistoryState }): void
  /** Re-reads the lesson from main: the stored messages replace the local copies. Null if that fails. */
  sync(): Promise<LessonView | null>
  toast: ToastApi
}
