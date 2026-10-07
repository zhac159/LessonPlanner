import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RegionActionBar } from './RegionActionBar'

const setup = (autoFocus = false) => {
  const handlers = { onAddAsset: vi.fn(), onAskClaude: vi.fn(), onDismiss: vi.fn() }
  render(<RegionActionBar regionNumber={1} autoFocus={autoFocus} {...handlers} />)
  return handlers
}

describe('RegionActionBar', () => {
  it('is a toolbar named "Region 1" with the three controls', () => {
    setup()
    expect(screen.getByRole('toolbar', { name: 'Region 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add asset here' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask Claude' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide these options' })).toBeInTheDocument()
  })

  it('calls each handler', async () => {
    const h = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Add asset here' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ask Claude' }))
    await userEvent.click(screen.getByRole('button', { name: 'Hide these options' }))
    expect(h.onAddAsset).toHaveBeenCalledTimes(1)
    expect(h.onAskClaude).toHaveBeenCalledTimes(1)
    expect(h.onDismiss).toHaveBeenCalledTimes(1)
  })

  it('focuses "Add asset here" when opened by keyboard', () => {
    setup(true)
    expect(screen.getByRole('button', { name: 'Add asset here' })).toHaveFocus()
  })

  it('does not take focus otherwise', () => {
    setup(false)
    expect(screen.getByRole('button', { name: 'Add asset here' })).not.toHaveFocus()
  })

  it('Esc hides the bar only', async () => {
    const h = setup(true)
    await userEvent.keyboard('{Escape}')
    expect(h.onDismiss).toHaveBeenCalledTimes(1)
    expect(h.onAddAsset).not.toHaveBeenCalled()
  })

  it('arrow keys move between the buttons and wrap', async () => {
    setup(true)
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Ask Claude' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Add asset here' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('button', { name: 'Hide these options' })).toHaveFocus()
  })
})
