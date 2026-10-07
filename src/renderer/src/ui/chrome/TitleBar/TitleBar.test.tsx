import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TitleBar, type TitleBarProps } from './TitleBar'

function setup(props: Partial<TitleBarProps> = {}) {
  const handlers = { onMinimize: vi.fn(), onToggleMaximize: vi.fn(), onClose: vi.fn() }
  render(<TitleBar title="Slide Planner" maximized={false} {...handlers} {...props} />)
  return handlers
}

describe('TitleBar', () => {
  it('shows the wordmark and three named window buttons with stable test ids', () => {
    setup()
    expect(screen.getByText('Slide Planner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Minimise' })).toHaveAttribute(
      'data-testid',
      'window-minimize'
    )
    expect(screen.getByRole('button', { name: 'Maximise' })).toHaveAttribute(
      'data-testid',
      'window-maximize'
    )
    expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute(
      'data-testid',
      'window-close'
    )
    expect(screen.getByTestId('titlebar')).toBeInTheDocument()
  })

  it('calls the right handler for each button', async () => {
    const user = userEvent.setup()
    const { onMinimize, onToggleMaximize, onClose } = setup()
    await user.click(screen.getByRole('button', { name: 'Minimise' }))
    await user.click(screen.getByRole('button', { name: 'Maximise' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onMinimize).toHaveBeenCalledTimes(1)
    expect(onToggleMaximize).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('offers Restore instead of Maximise when the window is maximised', () => {
    setup({ maximized: true })
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Maximise' })).not.toBeInTheDocument()
  })

  it('exposes the floating and inactive states as attributes', () => {
    setup({ floating: true, inactive: true })
    const bar = screen.getByTestId('titlebar')
    expect(bar).toHaveAttribute('data-floating', 'true')
    expect(bar).toHaveAttribute('data-inactive', 'true')
  })

  it('is not floating or inactive by default', () => {
    setup()
    expect(screen.getByTestId('titlebar')).toHaveAttribute('data-floating', 'false')
    expect(screen.getByTestId('titlebar')).not.toHaveAttribute('data-inactive')
  })

  it('works from the keyboard', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()
    await user.tab()
    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
