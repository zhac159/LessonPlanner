import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { initialTranscript } from './transcriptState'
import { useTranscript } from './useTranscript'

describe('useTranscript', () => {
  it('reads the newest state at once, and hands out the same getState and dispatch after every update', () => {
    const { result } = renderHook(() => useTranscript(() => initialTranscript([], null)))
    const { getState, dispatch } = result.current
    act(() => dispatch({ type: 'start', turn: { kind: 'chat' } }))
    expect(result.current.getState().live?.kind).toBe('chat')
    act(() => dispatch({ type: 'changed' }))
    // Effects list getState as a dependency: a new identity per update made them re-run after every transcript
    // change, and the history re-read in useChatSession then looped forever.
    expect(result.current.getState).toBe(getState)
    expect(result.current.dispatch).toBe(dispatch)
    expect(getState().live?.changed).toBe(true)
  })
})
