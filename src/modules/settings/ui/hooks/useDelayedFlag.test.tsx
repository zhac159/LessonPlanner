import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDelayedFlag } from './useDelayedFlag'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useDelayedFlag', () => {
  it('turns true only after the delay', () => {
    const { result } = renderHook(({ flag }) => useDelayedFlag(flag, 300), {
      initialProps: { flag: true }
    })
    expect(result.current).toBe(false)
    act(() => void vi.advanceTimersByTime(299))
    expect(result.current).toBe(false)
    act(() => void vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)
  })

  it('never turns true when the flag drops before the delay', () => {
    const { result, rerender } = renderHook(({ flag }) => useDelayedFlag(flag, 300), {
      initialProps: { flag: true }
    })
    act(() => void vi.advanceTimersByTime(200))
    rerender({ flag: false })
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current).toBe(false)
  })

  it('turns false at once when the flag drops', () => {
    const { result, rerender } = renderHook(({ flag }) => useDelayedFlag(flag, 300), {
      initialProps: { flag: true }
    })
    act(() => void vi.advanceTimersByTime(300))
    expect(result.current).toBe(true)
    rerender({ flag: false })
    expect(result.current).toBe(false)
  })
})
