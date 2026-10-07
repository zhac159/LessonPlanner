import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LessonTitleField } from './LessonTitleField'

function setup(value = '') {
  const onCommit = vi.fn()
  render(<LessonTitleField value={value} onCommit={onCommit} />)
  return {
    onCommit,
    user: userEvent.setup(),
    field: screen.getByRole('textbox', { name: 'Lesson title' })
  }
}

describe('LessonTitleField', () => {
  it('shows the placeholder when empty and limits the length to 80', () => {
    const { field } = setup()
    expect(field).toHaveAttribute('placeholder', 'Untitled lesson')
    expect(field).toHaveAttribute('maxlength', '80')
  })

  it('commits on Enter, trimmed, and leaves the field', async () => {
    const { user, field, onCommit } = setup()
    await user.type(field, '  Light  {Enter}')
    expect(onCommit).toHaveBeenCalledWith('Light')
    expect(field).not.toHaveFocus()
  })

  it('commits when she leaves the field', async () => {
    const { user, field, onCommit } = setup()
    await user.type(field, 'Sound')
    await user.tab()
    expect(onCommit).toHaveBeenCalledWith('Sound')
  })

  it('puts the old title back on Esc', async () => {
    const { user, field, onCommit } = setup('Old title')
    await user.type(field, ' and more')
    await user.keyboard('{Escape}')
    expect(field).toHaveValue('Old title')
    await user.tab()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not commit an unchanged title', async () => {
    const { user, field, onCommit } = setup('Same')
    await user.click(field)
    await user.tab()
    expect(onCommit).not.toHaveBeenCalled()
  })
})
