import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RegionLabel } from './RegionLabel'

describe('RegionLabel', () => {
  it('shows the number and "Circled" by default', () => {
    const { container } = render(<RegionLabel n={2} />)
    expect(container).toHaveTextContent('2')
    expect(container).toHaveTextContent('Circled')
  })

  it('shows a custom caption', () => {
    render(<RegionLabel n={1} text="Swap for a diagram" />)
    expect(screen.getByText('Swap for a diagram')).toBeInTheDocument()
  })

  it('is decorative without a remove handler', () => {
    const { container } = render(<RegionLabel n={1} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('has a labelled remove button that calls onRemove', async () => {
    const onRemove = vi.fn()
    render(<RegionLabel n={3} onRemove={onRemove} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove region 3' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('lets keyboard users reach the remove button', async () => {
    const onRemove = vi.fn()
    render(<RegionLabel n={3} onRemove={onRemove} />)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Remove region 3' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onRemove).toHaveBeenCalled()
  })

  it('marks the linked highlight', () => {
    const { container } = render(<RegionLabel n={1} linked />)
    expect(container.firstElementChild).toHaveAttribute('data-linked', 'true')
  })

  it('adds progress dots while the buddy works', () => {
    const { container, rerender } = render(<RegionLabel n={1} />)
    expect(container.querySelector('.ui-dots')).toBeNull()
    rerender(<RegionLabel n={1} busy />)
    expect(container.querySelector('.ui-dots')).not.toBeNull()
  })
})
