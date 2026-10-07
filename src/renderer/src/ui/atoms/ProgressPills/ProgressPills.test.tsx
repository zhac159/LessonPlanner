import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProgressPills } from './ProgressPills'

const STEPS = [
  { id: 'about', label: 'About you' },
  { id: 'claude', label: 'Connect Claude' },
  { id: 'style', label: 'Your style' }
]

describe('ProgressPills', () => {
  it('labels the list with the step count and marks the current step', () => {
    render(<ProgressPills steps={STEPS} current={1} />)
    expect(screen.getByRole('list', { name: 'Setup progress: step 2 of 3' })).toBeInTheDocument()
    expect(screen.getByText('Connect Claude')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Your style')).toHaveAttribute('data-state', 'upcoming')
    expect(screen.getByText('About you')).toHaveAttribute('data-state', 'done')
  })

  it('makes done pills buttons that go back, and leaves others static', async () => {
    const onStepClick = vi.fn()
    render(<ProgressPills steps={STEPS} current={2} onStepClick={onStepClick} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    await userEvent.click(within(buttons[0]!.parentElement!).getByRole('button'))
    expect(onStepClick).toHaveBeenCalledWith(0)
    expect(screen.getByText('Your style')).not.toHaveAttribute('type')
  })

  it('has no buttons without a handler', () => {
    render(<ProgressPills steps={STEPS} current={2} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders only the real steps as list items for assistive tech', () => {
    render(<ProgressPills steps={STEPS} current={0} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})
