import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TextLink } from './TextLink'

describe('TextLink', () => {
  it('is a button that never submits forms by accident', () => {
    render(<TextLink>Skip for now</TextLink>)
    expect(screen.getByRole('button', { name: 'Skip for now' })).toHaveAttribute('type', 'button')
  })

  it('calls onClick and respects disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<TextLink onClick={onClick}>Manage</TextLink>)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(
      <TextLink onClick={onClick} disabled>
        Manage
      </TextLink>
    )
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
