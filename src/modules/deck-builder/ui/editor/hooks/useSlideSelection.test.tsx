import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { readLastSlide, useSlideSelection } from './useSlideSelection'

const KEY = 'slide-planner:last-slide:les_1'

beforeEach(() => window.localStorage.clear())

const setup = (ids: string[]) =>
  renderHook(({ slideIds }) => useSlideSelection('les_1', slideIds), {
    initialProps: { slideIds: ids }
  })

describe('useSlideSelection', () => {
  it('selects the first slide of a lesson', () => {
    const { result } = setup(['a', 'b', 'c'])
    expect(result.current.selection).toEqual({ ids: ['a'], current: 'a', anchor: 'a' })
  })

  it('selects the slide she was on last time, when it still exists', () => {
    window.localStorage.setItem(KEY, 'b')
    expect(setup(['a', 'b', 'c']).result.current.selection.current).toBe('b')
    window.localStorage.setItem(KEY, 'gone')
    expect(setup(['a', 'b', 'c']).result.current.selection.current).toBe('a')
  })

  it('has no selection for an empty deck, then picks the first slide when slides arrive', () => {
    const { result, rerender } = setup([])
    expect(result.current.selection.current).toBeNull()
    rerender({ slideIds: ['a', 'b'] })
    expect(result.current.selection.current).toBe('a')
  })

  it('select, extend, toggle, step and collapse follow the filmstrip rules', () => {
    const { result } = setup(['a', 'b', 'c', 'd'])
    act(() => result.current.select('b'))
    expect(result.current.selection.current).toBe('b')
    act(() => result.current.extend('d'))
    expect(result.current.selection.ids).toEqual(['b', 'c', 'd'])
    act(() => result.current.collapse())
    expect(result.current.selection.ids).toEqual(['d'])
    act(() => result.current.toggle('a'))
    expect(result.current.selection.ids).toEqual(['a', 'd'])
    act(() => result.current.step('first'))
    expect(result.current.selection.ids).toEqual(['a'])
    act(() => result.current.step('next', true))
    expect(result.current.selection.ids).toEqual(['a', 'b'])
  })

  it('remembers the current slide', () => {
    const { result } = setup(['a', 'b'])
    act(() => result.current.select('b'))
    expect(readLastSlide('les_1')).toBe('b')
  })

  it('drops deleted slides and shows the neighbour', () => {
    const { result, rerender } = setup(['a', 'b', 'c'])
    act(() => result.current.select('b'))
    rerender({ slideIds: ['a', 'c'] })
    expect(result.current.selection.current).toBe('c')
  })

  it('never moves when slides are only added', () => {
    const { result, rerender } = setup(['a', 'b'])
    act(() => result.current.select('b'))
    rerender({ slideIds: ['new', 'a', 'b'] })
    expect(result.current.selection.current).toBe('b')
  })

  it('works when storage is unavailable', () => {
    const real = Object.getOwnPropertyDescriptor(window, 'localStorage')
    const blocked = () => {
      throw new Error('blocked')
    }
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem: blocked, setItem: blocked }
    })
    try {
      const { result } = setup(['a', 'b'])
      act(() => result.current.select('b'))
      expect(result.current.selection.current).toBe('b')
      expect(readLastSlide('les_1')).toBeNull()
    } finally {
      if (real) Object.defineProperty(window, 'localStorage', real)
    }
  })
})
