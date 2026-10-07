import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SelectionBar } from './SelectionBar'

const props = {
  count: 3,
  hint: 'Pick a few that show the look you want',
  actionLabel: 'Make a new one like these',
  onAction: () => {},
  onClear: () => {}
}

describe('SelectionBar', () => {
  it('shows the count, the hint and both buttons', () => {
    render(<SelectionBar {...props} />)
    expect(screen.getByRole('status')).toHaveTextContent('3 selected')
    expect(screen.getByText('Pick a few that show the look you want')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make a new one like these' })).toBeInTheDocument()
  })

  it('calls Clear and the action', async () => {
    const onClear = vi.fn()
    const onAction = vi.fn()
    render(<SelectionBar {...props} onClear={onClear} onAction={onAction} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await userEvent.click(screen.getByRole('button', { name: 'Make a new one like these' }))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('a disabled action stays focusable, explains itself and does not fire', async () => {
    const onAction = vi.fn()
    render(
      <SelectionBar {...props} actionDisabled actionHint="Pick one first" onAction={onAction} />
    )
    const action = screen.getByRole('button', { name: 'Make a new one like these' })
    expect(action).toHaveAttribute('aria-disabled', 'true')
    expect(action).toHaveAttribute('title', 'Pick one first')
    await userEvent.click(action)
    expect(onAction).not.toHaveBeenCalled()
  })

  it('works without a hint and can relabel Clear', () => {
    render(<SelectionBar {...props} hint={undefined} clearLabel="Untick all" count={1} />)
    expect(screen.getByRole('status')).toHaveTextContent('1 selected')
    expect(screen.getByRole('button', { name: 'Untick all' })).toBeInTheDocument()
  })

  it('shows a busy action', () => {
    render(<SelectionBar {...props} actionLoading />)
    expect(screen.getByRole('button', { name: /Make a new one like these/ })).toHaveAttribute(
      'aria-busy',
      'true'
    )
  })
})
