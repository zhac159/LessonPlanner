import { describe, expect, it } from 'vitest'
import {
  EMPTY_SELECTION,
  extendTo,
  reconcileSelection,
  selectOnly,
  stepSelection,
  stepTarget,
  toggleId
} from './selection'

const IDS = ['a', 'b', 'c', 'd', 'e']

describe('selectOnly / extendTo', () => {
  it('a plain click selects one slide', () => {
    expect(selectOnly('c')).toEqual({ ids: ['c'], current: 'c', anchor: 'c' })
  })

  it('extends from the anchor in either direction and keeps deck order', () => {
    const start = selectOnly('b')
    expect(extendTo(IDS, start, 'd')).toEqual({ ids: ['b', 'c', 'd'], current: 'd', anchor: 'b' })
    expect(extendTo(IDS, selectOnly('d'), 'b')).toEqual({
      ids: ['b', 'c', 'd'],
      current: 'b',
      anchor: 'd'
    })
  })

  it('starts a range at the target when there is no anchor, and ignores unknown ids', () => {
    expect(extendTo(IDS, EMPTY_SELECTION, 'c').ids).toEqual(['c'])
    expect(extendTo(IDS, selectOnly('a'), 'zzz')).toEqual(selectOnly('a'))
  })
})

describe('toggleId', () => {
  it('adds a slide and makes it the one on the stage', () => {
    const next = toggleId(IDS, selectOnly('d'), 'b')
    expect(next.ids).toEqual(['b', 'd'])
    expect(next.current).toBe('b')
  })

  it('removes a slide, moving the stage to the last remaining one', () => {
    const both = toggleId(IDS, selectOnly('b'), 'd')
    const next = toggleId(IDS, both, 'd')
    expect(next).toEqual({ ids: ['b'], current: 'b', anchor: 'b' })
  })

  it('never removes the last selected slide', () => {
    const only = selectOnly('b')
    expect(toggleId(IDS, only, 'b')).toBe(only)
  })

  it('ignores slides that are not in the deck', () => {
    const only = selectOnly('b')
    expect(toggleId(IDS, only, 'zzz')).toBe(only)
  })
})

describe('stepTarget / stepSelection', () => {
  it('moves one slide and clamps at the ends', () => {
    expect(stepTarget(IDS, 'b', 'next')).toBe('c')
    expect(stepTarget(IDS, 'b', 'prev')).toBe('a')
    expect(stepTarget(IDS, 'a', 'prev')).toBe('a')
    expect(stepTarget(IDS, 'e', 'next')).toBe('e')
    expect(stepTarget(IDS, 'c', 'first')).toBe('a')
    expect(stepTarget(IDS, 'c', 'last')).toBe('e')
  })

  it('has no target in an empty deck', () => {
    expect(stepTarget([], null, 'next')).toBeNull()
    expect(stepSelection([], EMPTY_SELECTION, 'next', false)).toEqual(EMPTY_SELECTION)
  })

  it('starts at the first slide when nothing is current', () => {
    expect(stepTarget(IDS, null, 'next')).toBe('a')
  })

  it('moves the selection, or grows it with Shift', () => {
    expect(stepSelection(IDS, selectOnly('b'), 'next', false)).toEqual(selectOnly('c'))
    expect(stepSelection(IDS, selectOnly('b'), 'next', true)).toEqual({
      ids: ['b', 'c'],
      current: 'c',
      anchor: 'b'
    })
  })
})

describe('reconcileSelection', () => {
  it('keeps the selection when the deck only gained slides', () => {
    const selection = selectOnly('b')
    expect(reconcileSelection(['a', 'new', 'b', 'c'], selection, ['a', 'b', 'c'])).toEqual(
      selection
    )
  })

  it('drops slides that are gone from a multi-selection', () => {
    const selection = extendTo(IDS, selectOnly('b'), 'd')
    const next = reconcileSelection(['a', 'b', 'd', 'e'], selection, IDS)
    expect(next.ids).toEqual(['b', 'd'])
    expect(next.current).toBe('d')
  })

  it('shows the neighbour that took the place of the deleted current slide', () => {
    const next = reconcileSelection(['a', 'c', 'd', 'e'], selectOnly('b'), IDS)
    expect(next).toEqual(selectOnly('c'))
  })

  it('falls back to the last slide when the last one was deleted', () => {
    expect(reconcileSelection(['a', 'b'], selectOnly('c'), ['a', 'b', 'c'])).toEqual(
      selectOnly('b')
    )
  })

  it('is empty for an empty deck', () => {
    expect(reconcileSelection([], selectOnly('a'), ['a'])).toEqual(EMPTY_SELECTION)
  })

  it('selects the first slide when the deck gets its first slides', () => {
    expect(reconcileSelection(['a', 'b'], EMPTY_SELECTION, [])).toEqual(selectOnly('a'))
  })
})
