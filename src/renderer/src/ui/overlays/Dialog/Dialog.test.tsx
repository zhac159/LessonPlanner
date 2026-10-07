import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

function Harness({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rename lesson"
        description="Pick a clear name."
        dismissible={dismissible}
        footer={<button onClick={() => setOpen(false)}>Done</button>}
      >
        <input aria-label="Name" />
      </Dialog>
    </>
  )
}

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    render(<Dialog open={false} onClose={() => {}} title="Hidden" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is a modal dialog labelled by its title and described by its description', () => {
    render(
      <Dialog open onClose={() => {}} title="Rename lesson" description="Pick a clear name." />
    )
    const dialog = screen.getByRole('dialog', { name: 'Rename lesson' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Pick a clear name.')
  })

  it('moves focus inside on open and returns it to the opener on close', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('Open it'))
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    await user.click(screen.getByText('Done'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Open it')).toHaveFocus()
  })

  it('traps Tab inside the dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('Open it'))
    for (let i = 0; i < 6; i++) {
      await user.tab()
      expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it('closes on Escape, the close button and a backdrop click', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Dialog open onClose={onClose} title="T" />)
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('does not close when clicking inside the dialog', async () => {
    const onClose = vi.fn()
    render(<Dialog open onClose={onClose} title="T" description="inside" />)
    await userEvent.click(screen.getByText('inside'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('cannot be dismissed when dismissible is off', async () => {
    const user = userEvent.setup()
    render(<Harness dismissible={false} />)
    await user.click(screen.getByText('Open it'))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })
})
