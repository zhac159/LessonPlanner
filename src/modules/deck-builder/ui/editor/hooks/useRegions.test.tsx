import { act, renderHook, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeSlide } from '@shared/deck/testing'
import { createFakeClients } from '@test/render'
import type { RegionDraft } from '../../seams'
import { hookWrapper } from '../testing'
import { useRegions } from './useRegions'

const region = (id: string, n: number, slideId: string): RegionDraft => ({
  id,
  n,
  slideId,
  path: [],
  bbox: { x: 0, y: 0, w: 10, h: 10 },
  targetElementIds: []
})
const slides = (...ids: string[]) => ids.map((id) => makeSlide(id))

const setup = (ids: string[]) =>
  renderHook(({ list }) => useRegions(slides(...list)), {
    initialProps: { list: ids },
    wrapper: hookWrapper(createFakeClients())
  })

describe('useRegions', () => {
  it('adds and removes regions, keeping numbers as they are', () => {
    const { result } = setup(['a'])
    act(() => result.current.add(region('r1', 1, 'a')))
    act(() => result.current.add(region('r2', 2, 'a')))
    act(() => result.current.remove('r1'))
    expect(result.current.regions.map((r) => r.n)).toEqual([2])
  })

  it('replaces the list from the chat', () => {
    const { result } = setup(['a'])
    act(() => result.current.add(region('r1', 1, 'a')))
    act(() => result.current.setRegions([]))
    expect(result.current.regions).toEqual([])
  })

  it('tracks the highlighted region', () => {
    const { result } = setup(['a'])
    act(() => result.current.setHighlightedId('r1'))
    expect(result.current.highlightedId).toBe('r1')
  })

  it('drops the regions of a deleted slide and says so once', async () => {
    const { result, rerender } = setup(['a', 'b'])
    act(() => result.current.add(region('r1', 1, 'a')))
    act(() => result.current.add(region('r2', 2, 'b')))
    rerender({ list: ['b'] })
    expect(result.current.regions.map((r) => r.id)).toEqual(['r2'])
    expect(await screen.findByText('Region 1 was on a deleted slide.')).toBeInTheDocument()
  })

  it('keeps regions while the deck has no slides yet (still generating)', () => {
    const { result } = setup([])
    act(() => result.current.add(region('r1', 1, 'a')))
    expect(result.current.regions).toHaveLength(1)
  })
})
