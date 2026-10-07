import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lasso } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { Callout } from './Callout'

describe('Callout', () => {
  it('is a note with a title and body by default', () => {
    render(<Callout title="Can I use Claude Pro?">Not in other apps.</Callout>)
    const note = screen.getByRole('note')
    expect(note).toHaveAttribute('data-variant', 'info')
    expect(note).toHaveTextContent('Can I use Claude Pro?')
    expect(note).toHaveTextContent('Not in other apps.')
  })

  it('announces errors as alerts and gives them an icon', () => {
    const { container } = render(<Callout variant="error">I couldn’t load your lessons.</Callout>)
    expect(screen.getByRole('alert')).toHaveTextContent('I couldn’t load your lessons.')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('does not use the alert role for other variants', () => {
    render(<Callout variant="warning">Pupil names</Callout>)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveAttribute('data-variant', 'warning')
  })

  it('shows a custom icon on tips', () => {
    const { container } = render(
      <Callout variant="tip" icon={<Lasso data-testid="lasso" />}>
        Circle it
      </Callout>
    )
    expect(screen.getByTestId('lasso')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('data-variant', 'tip')
  })

  it('renders an action slot', () => {
    render(
      <Callout variant="action" action={<button type="button">Connect Claude</button>}>
        Claude isn’t connected yet.
      </Callout>
    )
    expect(screen.getByRole('button', { name: 'Connect Claude' })).toBeInTheDocument()
  })

  it('has no dismiss button unless asked, and calls onDismiss when clicked', async () => {
    const onDismiss = vi.fn()
    const { rerender } = render(<Callout variant="tip">Hint</Callout>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    rerender(
      <Callout variant="tip" onDismiss={onDismiss}>
        Hint
      </Callout>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
