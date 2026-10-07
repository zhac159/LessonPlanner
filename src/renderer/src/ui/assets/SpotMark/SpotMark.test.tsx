import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SpotMark } from './SpotMark'

describe('SpotMark', () => {
  it('shows "Picture spot", the description and the "Fill this spot" pill', () => {
    render(<SpotMark description="A leaf in sunlight, close up" onFill={() => {}} />)
    expect(screen.getByText('Picture spot')).toBeInTheDocument()
    expect(screen.getByText('A leaf in sunlight, close up')).toBeInTheDocument()
    expect(screen.getByText('Fill this spot')).toBeInTheDocument()
  })

  it('is one real button named after the spot, with no button nested inside', async () => {
    const onFill = vi.fn()
    render(<SpotMark description="A leaf in sunlight, close up" onFill={onFill} />)
    const button = screen.getByRole('button', {
      name: 'Fill picture spot: A leaf in sunlight, close up'
    })
    expect(button.querySelector('button')).toBeNull()
    await userEvent.click(button)
    button.focus()
    await userEvent.keyboard('{Enter}')
    expect(onFill).toHaveBeenCalledTimes(2)
  })

  it('is plain content without a handler', () => {
    render(<SpotMark description="A leaf" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('A leaf')).toBeInTheDocument()
  })

  it('marks a selected spot', () => {
    render(<SpotMark description="A leaf" onFill={() => {}} selected />)
    expect(screen.getByRole('button')).toHaveAttribute('data-selected', 'true')
  })

  it('the faint variant (thumbnails) has no text and is hidden from assistive tech', () => {
    const { container } = render(
      <SpotMark description="A leaf" variant="faint" onFill={() => {}} />
    )
    expect(container.textContent).toBe('')
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('can relabel the pill', () => {
    render(<SpotMark description="x" onFill={() => {}} fillLabel="Fill" />)
    expect(screen.getByText('Fill')).toBeInTheDocument()
  })
})
