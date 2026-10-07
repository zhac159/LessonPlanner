import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Plus, X } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  it('is named by its aria-label and hides the icon from assistive tech', () => {
    render(
      <IconButton aria-label="Add a plugin">
        <Plus data-testid="icon" />
      </IconButton>
    )
    expect(screen.getByRole('button', { name: 'Add a plugin' })).toHaveAttribute('type', 'button')
    expect(screen.getByTestId('icon').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('exposes the variant and defaults to round', () => {
    const { rerender } = render(<IconButton aria-label="a">x</IconButton>)
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'round')
    rerender(
      <IconButton aria-label="a" variant="ghost">
        <X />
      </IconButton>
    )
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'ghost')
  })

  it('calls onClick from mouse and keyboard but not when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <IconButton aria-label="Remove" onClick={onClick}>
        x
      </IconButton>
    )
    await user.click(screen.getByRole('button'))
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(2)
    rerender(
      <IconButton aria-label="Remove" onClick={onClick} disabled>
        x
      </IconButton>
    )
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('passes toggle state through for styling and assistive tech', () => {
    render(
      <IconButton aria-label="Plugins" aria-expanded="true" aria-pressed="true">
        x
      </IconButton>
    )
    const button = screen.getByRole('button', { name: 'Plugins' })
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })
})
