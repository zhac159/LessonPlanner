import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResultChip, UNDO_BLOCKED_HINT } from './ResultChip'

describe('ResultChip', () => {
  it('shows the outcome and an Undo that fires', async () => {
    const onUndo = vi.fn()
    render(<ResultChip label="8 slides added" onUndo={onUndo} />)
    expect(screen.getByText('8 slides added')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('offers "Refine in chat" only when asked and not once undone', async () => {
    const onRefine = vi.fn()
    const { rerender } = render(<ResultChip label="x" onUndo={() => {}} onRefine={onRefine} />)
    await userEvent.click(screen.getByRole('button', { name: 'Refine in chat' }))
    expect(onRefine).toHaveBeenCalledTimes(1)
    rerender(<ResultChip label="x" undone onRedo={() => {}} onRefine={onRefine} />)
    expect(screen.queryByRole('button', { name: 'Refine in chat' })).toBeNull()
  })

  it('reads "Undone" with a Redo action after undo', async () => {
    const onRedo = vi.fn()
    const { container } = render(<ResultChip label="8 slides added" undone onRedo={onRedo} />)
    expect(screen.getByText('Undone')).toBeInTheDocument()
    expect(screen.queryByText('8 slides added')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    expect(container.firstElementChild).toHaveAttribute('data-state', 'undone')
    await userEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(onRedo).toHaveBeenCalledTimes(1)
  })

  it('keeps Undo but disabled when undone and there is nothing to redo', async () => {
    const onUndo = vi.fn()
    render(<ResultChip label="x" undone onUndo={onUndo} />)
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toBeDisabled()
    await userEvent.click(undo)
    expect(onUndo).not.toHaveBeenCalled()
  })

  it('disables Undo with a hint when a later change exists, and does not fire', async () => {
    const onUndo = vi.fn()
    render(<ResultChip label="x" canUndo={false} onUndo={onUndo} />)
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(undo)
    expect(onUndo).not.toHaveBeenCalled()
    undo.focus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(UNDO_BLOCKED_HINT)
  })

  it('shows a spinner and ignores clicks while busy', async () => {
    const onUndo = vi.fn()
    render(<ResultChip label="x" busy onUndo={onUndo} />)
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(undo)
    expect(onUndo).not.toHaveBeenCalled()
  })

  it('makes the pill a button that selects the slide when onSelect is given', async () => {
    const onSelect = vi.fn()
    render(<ResultChip label="Slide 3 changed" onSelect={onSelect} onUndo={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Slide 3 changed' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('reports hover so thumbnails can be outlined', async () => {
    const onHighlight = vi.fn()
    render(<ResultChip label="x" onUndo={() => {}} onHighlight={onHighlight} />)
    const undo = screen.getByRole('button', { name: 'Undo' })
    await userEvent.hover(undo)
    expect(onHighlight).toHaveBeenLastCalledWith(true)
    await userEvent.unhover(undo)
    expect(onHighlight).toHaveBeenLastCalledWith(false)
  })
})
