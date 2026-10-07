import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RenameLessonDialog } from './RenameLessonDialog'

function setup(props: Partial<Parameters<typeof RenameLessonDialog>[0]> = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(
    <RenameLessonDialog
      title="Photosynthesis"
      busy={false}
      error={null}
      onSave={onSave}
      onCancel={onCancel}
      {...props}
    />
  )
  return { onSave, onCancel }
}

describe('RenameLessonDialog', () => {
  it('renders nothing while closed', () => {
    setup({ title: null })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows "Rename lesson" with the current title in a labelled field', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Rename lesson' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Lesson title' })).toHaveValue('Photosynthesis')
  })

  it('saves the trimmed edit on Enter', async () => {
    const { onSave } = setup()
    const field = screen.getByRole('textbox', { name: 'Lesson title' })
    await userEvent.clear(field)
    await userEvent.type(field, 'Plant energy{Enter}')
    expect(onSave).toHaveBeenCalledWith('Plant energy')
  })

  it('saves with the Save button', async () => {
    const { onSave } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith('Photosynthesis')
  })

  it('does not allow an empty title', async () => {
    const { onSave } = setup()
    await userEvent.clear(screen.getByRole('textbox', { name: 'Lesson title' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await userEvent.keyboard('{Enter}')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('cancels with Cancel and with Esc', async () => {
    const { onCancel } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('shows why a save failed', () => {
    setup({ error: 'Couldn’t save that. Try again.' })
    expect(screen.getByRole('textbox', { name: 'Lesson title' })).toBeInvalid()
    expect(screen.getByText('Couldn’t save that. Try again.')).toBeInTheDocument()
  })
})
