import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MessageProgress } from './MessageProgress'

describe('MessageProgress', () => {
  it('is a status region carrying the label', () => {
    render(<MessageProgress label="Drawing your leaf diagram…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Drawing your leaf diagram…')
  })

  it('has no Stop button unless asked', () => {
    render(<MessageProgress label="Working…" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('calls onStop from the Stop button, by mouse and keyboard', async () => {
    const onStop = vi.fn()
    render(<MessageProgress label="Working…" onStop={onStop} />)
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    screen.getByRole('button', { name: 'Stop' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(onStop).toHaveBeenCalledTimes(2)
  })

  it('lets the Stop wording be changed', () => {
    render(<MessageProgress label="x" onStop={() => {}} stopLabel="Cancel" />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('lists steps with their state spoken for screen readers', () => {
    render(
      <MessageProgress
        label="Making your quiz…"
        steps={[
          { label: 'Reading the slides', state: 'done' },
          { label: 'Writing questions', state: 'running' },
          { label: 'Checking answers', state: 'upcoming' }
        ]}
      />
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveAttribute('data-state', 'done')
    expect(items[0]).toHaveTextContent('Reading the slides (done)')
    expect(items[1]).toHaveTextContent('Writing questions (in progress)')
    expect(items[2]).toHaveTextContent('Checking answers (waiting)')
  })

  it('shows a failed step', () => {
    render(<MessageProgress label="x" steps={[{ label: 'Saving', state: 'error' }]} />)
    expect(screen.getByRole('listitem')).toHaveTextContent('Saving (failed)')
  })

  it('shows at most four steps, keeping the current one in view', () => {
    const steps = Array.from({ length: 8 }, (_, i) => ({
      label: `Step ${i + 1}`,
      state: i < 5 ? ('done' as const) : i === 5 ? ('running' as const) : ('upcoming' as const)
    }))
    render(<MessageProgress label="x" steps={steps} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(screen.getByText('Step 6')).toBeInTheDocument()
  })

  it('is indeterminate without progress and determinate with it', () => {
    const { rerender } = render(<MessageProgress label="Working…" />)
    expect(screen.queryByRole('progressbar')).toBeNull()
    rerender(
      <MessageProgress
        label="Making slides…"
        progress={{ value: 3, max: 8, label: 'Slide 3 of 8' }}
      />
    )
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(bar).toHaveAttribute('aria-valuemax', '8')
    expect(within(screen.getByRole('status')).getByText('Slide 3 of 8')).toBeInTheDocument()
  })
})
