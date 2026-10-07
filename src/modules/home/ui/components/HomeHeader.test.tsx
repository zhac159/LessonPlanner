import { render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useHomeSearch } from '../hooks/useHomeSearch'
import { HomeHeader } from './HomeHeader'

function Harness({ onNewLesson }: { onNewLesson: () => void }) {
  const search = useHomeSearch(true)
  return <HomeHeader greeting="Good morning, Alice!" search={search} onNewLesson={onNewLesson} />
}

describe('HomeHeader', () => {
  it('shows the greeting as the page heading with its subtitle', () => {
    render(<Harness onNewLesson={() => {}} />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Good morning, Alice!' })
    ).toBeInTheDocument()
    expect(screen.getByText('What are we teaching today?')).toBeInTheDocument()
  })

  it('has a labelled search field', () => {
    render(<Harness onNewLesson={() => {}} />)
    const field = screen.getByRole('searchbox', { name: 'Search lessons and styles' })
    expect(field).toHaveAttribute('placeholder', 'Search lessons and styles')
  })

  it('calls onNewLesson from the New lesson button', async () => {
    const onNewLesson = vi.fn()
    render(<Harness onNewLesson={onNewLesson} />)
    await userEvent.click(screen.getByRole('button', { name: 'New lesson' }))
    expect(onNewLesson).toHaveBeenCalledTimes(1)
  })

  it('focuses the search with Ctrl+F', async () => {
    render(<Harness onNewLesson={() => {}} />)
    await userEvent.keyboard('{Control>}f{/Control}')
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })

  it('does not hijack Ctrl+F while the page is hidden', () => {
    const { result } = renderHook(() => useHomeSearch(false))
    const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(result.current.value).toBe('')
  })
})
