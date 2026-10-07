import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArrowRight, Plus } from 'lucide-react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders a real button with variant, size and shape data attributes', () => {
    render(
      <Button variant="primary" size="lg" shape="pill">
        Save style
      </Button>
    )
    const button = screen.getByRole('button', { name: 'Save style' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('data-variant', 'primary')
    expect(button).toHaveAttribute('data-size', 'lg')
    expect(button).toHaveAttribute('data-shape', 'pill')
  })

  it('defaults to a secondary md rectangle and forces sm to be a pill', () => {
    const { rerender } = render(<Button>Cancel</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'secondary')
    expect(screen.getByRole('button')).toHaveAttribute('data-size', 'md')
    expect(screen.getByRole('button')).toHaveAttribute('data-shape', 'rect')
    rerender(<Button size="sm">Undo</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('data-shape', 'pill')
  })

  it('shows leading and trailing icons without adding them to the accessible name', () => {
    render(
      <Button icon={<Plus data-testid="lead" />} iconAfter={<ArrowRight data-testid="trail" />}>
        New lesson
      </Button>
    )
    expect(screen.getByRole('button', { name: 'New lesson' })).toBeInTheDocument()
    expect(screen.getByTestId('lead').closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.getByTestId('trail')).toBeInTheDocument()
  })

  it('calls onClick, also from the keyboard', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Go</Button>)
    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveFocus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('ignores clicks when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>
    )
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toBeDisabled()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('stays focusable but inert with aria-disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Button aria-disabled="true" onClick={onClick}>
        Present
      </Button>
    )
    await user.tab()
    expect(screen.getByRole('button')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows the progress wording, sets aria-busy and ignores clicks while loading', async () => {
    const onClick = vi.fn()
    render(
      <Button loading loadingLabel="Making quiz…" icon={<Plus />} onClick={onClick}>
        Make quiz
      </Button>
    )
    const button = screen.getByRole('button', { name: 'Making quiz…' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
    expect(button.querySelector('.ui-button__spinner')).toBeInTheDocument()
    expect(button.querySelector('.ui-button__icon')).toBeNull()
  })

  it('keeps the normal label while loading when no loadingLabel is given', () => {
    render(<Button loading>Send</Button>)
    expect(screen.getByRole('button', { name: 'Send' })).toHaveAttribute('aria-busy', 'true')
  })

  it('forwards refs and extra attributes', () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <Button ref={ref} data-testid="x" type="submit">
        Go
      </Button>
    )
    expect(ref.current).toBe(screen.getByTestId('x'))
    expect(ref.current).toHaveAttribute('type', 'submit')
  })
})
