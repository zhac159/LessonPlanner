import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EditableTitle, TITLE_MAX } from './EditableTitle'

describe('EditableTitle', () => {
  it('shows the title in a field named "Title" limited to 60 characters', () => {
    render(<EditableTitle value="School logo" onCommit={() => {}} />)
    const field = screen.getByRole('textbox', { name: 'Title' })
    expect(field).toHaveValue('School logo')
    expect(field).toHaveAttribute('maxlength', String(TITLE_MAX))
  })

  it('commits a changed title on Enter and on blur', async () => {
    const onCommit = vi.fn()
    render(<EditableTitle value="School logo" onCommit={onCommit} />)
    const field = screen.getByRole('textbox')
    await userEvent.type(field, ' 2{Enter}')
    expect(onCommit).toHaveBeenLastCalledWith('School logo 2')
    await userEvent.type(field, '!')
    await userEvent.tab()
    expect(onCommit).toHaveBeenLastCalledWith('School logo 2!')
  })

  it('does not commit an unchanged title', async () => {
    const onCommit = vi.fn()
    render(<EditableTitle value="School logo" onCommit={onCommit} />)
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.tab()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('puts the old title back when it is emptied', async () => {
    const onCommit = vi.fn()
    render(<EditableTitle value="School logo" onCommit={onCommit} />)
    const field = screen.getByRole('textbox')
    await userEvent.clear(field)
    await userEvent.tab()
    expect(onCommit).not.toHaveBeenCalled()
    expect(field).toHaveValue('School logo')
  })

  it('Esc puts the saved title back', async () => {
    render(<EditableTitle value="School logo" onCommit={() => {}} />)
    const field = screen.getByRole('textbox')
    await userEvent.type(field, 'x{Escape}')
    expect(field).toHaveValue('School logo')
  })
})
