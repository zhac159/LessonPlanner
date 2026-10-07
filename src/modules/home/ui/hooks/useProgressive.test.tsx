import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useProgressive } from './useProgressive'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useProgressive', () => {
  it('starts with one page and grows with showMore until everything shows', () => {
    const { result } = renderHook(() => useProgressive(100, 'k', 10))
    expect(result.current.count).toBe(10)
    expect(result.current.more).toBe(true)
    act(() => result.current.showMore())
    expect(result.current.count).toBe(20)
    for (let i = 0; i < 8; i += 1) act(() => result.current.showMore())
    expect(result.current.more).toBe(false)
  })

  it('has no more when everything fits on one page', () => {
    const { result } = renderHook(() => useProgressive(5, 'k', 10))
    expect(result.current.more).toBe(false)
  })

  it('starts again at the first page when the key changes', () => {
    const { result, rerender } = renderHook(({ key }) => useProgressive(100, key, 10), {
      initialProps: { key: 'a' }
    })
    act(() => result.current.showMore())
    expect(result.current.count).toBe(20)
    rerender({ key: 'b' })
    expect(result.current.count).toBe(10)
  })

  it('loads the next page when the sentinel scrolls into view', () => {
    let notify: (entries: Array<{ isIntersecting: boolean }>) => void = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: typeof notify) {
          notify = callback
        }
        observe() {}
        disconnect() {
          disconnect()
        }
      }
    )
    function Harness() {
      const { count, more, sentinel } = useProgressive(100, 'k', 10)
      return (
        <div>
          <span data-testid="count">{count}</span>
          {more && <div ref={sentinel} />}
        </div>
      )
    }
    render(<Harness />)
    act(() => notify([{ isIntersecting: false }]))
    expect(screen.getByTestId('count')).toHaveTextContent('10')
    act(() => notify([{ isIntersecting: true }]))
    expect(screen.getByTestId('count')).toHaveTextContent('20')
    expect(disconnect).toHaveBeenCalled()
  })
})
