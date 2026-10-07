import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useControllable } from './useControllable'

describe('useControllable', () => {
  it('is uncontrolled without a value: it stores and reports changes', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useControllable<string>(undefined, 'a', onChange))
    expect(result.current[0]).toBe('a')
    act(() => result.current[1]('b'))
    expect(result.current[0]).toBe('b')
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('is controlled with a value: it reports but does not store', () => {
    const onChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useControllable<string>(value, 'a', onChange),
      { initialProps: { value: 'x' } }
    )
    act(() => result.current[1]('y'))
    expect(result.current[0]).toBe('x')
    expect(onChange).toHaveBeenCalledWith('y')
    rerender({ value: 'y' })
    expect(result.current[0]).toBe('y')
  })

  it('does not report a value equal to the current one', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useControllable<number>(undefined, 1, onChange))
    act(() => result.current[1](1))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps a stable setter that always sees the latest state', () => {
    const { result } = renderHook(() => useControllable<number>(undefined, 0))
    const set = result.current[1]
    act(() => set(1))
    act(() => set(1))
    expect(result.current[0]).toBe(1)
    expect(result.current[1]).toBe(set)
  })
})
