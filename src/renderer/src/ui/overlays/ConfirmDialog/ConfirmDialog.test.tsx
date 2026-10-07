import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function setup(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      open
      title="Remove your API key?"
      message="Slide Planner won’t be able to make or change slides until you add a key again."
      confirmLabel="Remove key"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />
  )
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('shows the question, the message and both buttons', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: 'Remove your API key?' })
    expect(dialog).toHaveAccessibleDescription(/won’t be able to make or change slides/)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove key' })).toBeInTheDocument()
  })

  it('confirms and cancels through the buttons', async () => {
    const user = userEvent.setup()
    const { onConfirm, onCancel } = setup()
    await user.click(screen.getByRole('button', { name: 'Remove key' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('cancels on Escape', async () => {
    const { onCancel, onConfirm } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('starts on the confirm button normally and on Cancel when destructive', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Remove key' })).toHaveFocus()
  })

  it('focuses Cancel first for destructive actions', () => {
    setup({ destructive: true })
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('uses a custom cancel label', () => {
    setup({ cancelLabel: 'Keep it' })
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeInTheDocument()
  })

  it('locks everything while busy', async () => {
    const { onCancel, onConfirm } = setup({ busy: true })
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove key' })).toHaveAttribute('aria-busy', 'true')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Remove key' }))
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('renders nothing when closed', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
