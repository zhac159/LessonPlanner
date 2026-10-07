import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { KeepForm, type KeepFormProps } from './KeepForm'

function setup(extra: Partial<KeepFormProps> = {}) {
  const h = { onNameChange: vi.fn(), onKeep: vi.fn(), onTryAgain: vi.fn() }
  render(<KeepForm version={3} name="bunsen_burner_icon" {...h} {...extra} />)
  return h
}

describe('KeepForm', () => {
  it('shows the name and "Keep version 3" with "Try again"', () => {
    setup()
    expect(screen.getByRole('textbox', { name: 'Name in chat' })).toHaveValue('bunsen_burner_icon')
    expect(screen.getByRole('button', { name: 'Keep version 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('says "Use version 3" for a picture spot', () => {
    setup({ verb: 'Use' })
    expect(screen.getByRole('button', { name: 'Use version 3' })).toBeInTheDocument()
  })

  it('keeps and tries again', async () => {
    const h = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Keep version 3' }))
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(h.onKeep).toHaveBeenCalledTimes(1)
    expect(h.onTryAgain).toHaveBeenCalledTimes(1)
  })

  it('reports name edits', async () => {
    const h = setup()
    await userEvent.type(screen.getByRole('textbox'), 'x')
    expect(h.onNameChange).toHaveBeenLastCalledWith('bunsen_burner_iconx')
  })

  it('without a chosen version Keep is off, says why and does nothing', async () => {
    const h = setup({ version: null })
    const button = screen.getByRole('button', { name: 'Keep a version' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button.getAttribute('aria-describedby')).toBe(
      screen.getByText('Pick a version first.').id
    )
    await userEvent.click(button)
    expect(h.onKeep).not.toHaveBeenCalled()
  })

  it('a taken name shows the message and keeps Keep off', async () => {
    const h = setup({ nameError: 'You already have an asset called bunsen_burner_icon.' })
    expect(
      screen.getByText('You already have an asset called bunsen_burner_icon.')
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    const button = screen.getByRole('button', { name: 'Keep version 3' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(button)
    expect(h.onKeep).not.toHaveBeenCalled()
  })

  it('shows a busy Keep button', () => {
    setup({ busy: true })
    expect(screen.getByRole('button', { name: /Keep version 3/ })).toHaveAttribute(
      'aria-busy',
      'true'
    )
  })
})
