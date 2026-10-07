import { useCallback, useRef, useState } from 'react'
import {
  initialTranscript,
  transcriptReducer,
  type TranscriptAction,
  type TranscriptState
} from './transcriptState'

export interface TranscriptStore {
  state: TranscriptState
  dispatch(action: TranscriptAction): void
  /** The newest state, even inside an event handler that runs before React re-renders. */
  getState(): TranscriptState
}

/**
 * `useReducer` with a synchronous read: streaming events can arrive several per tick, and a handler such as
 * "chat:done" must see what "chat:changes" just recorded.
 */
export function useTranscript(init: () => TranscriptState): TranscriptStore {
  const latest = useRef<TranscriptState | null>(null)
  if (latest.current === null) latest.current = init()
  const [state, setState] = useState<TranscriptState>(latest.current)
  const dispatch = useCallback((action: TranscriptAction) => {
    latest.current = transcriptReducer(latest.current ?? initialTranscript([], null), action)
    setState(latest.current)
  }, [])
  // Stable on purpose: effects list it as a dependency, and an identity that changed with every state update made
  // them run again after every transcript change (the history re-read in useChatSession looped forever).
  const getState = useCallback(() => latest.current as TranscriptState, [])
  return { state, dispatch, getState }
}
