import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChatNameField } from './ChatNameField'

describe('ChatNameField', () => {
  it('shows the saved name and the {{name}} helper, tied to the field', () => {
    render(<ChatNameField value="school_logo" onCommit={() => {}} />)
    const field = screen.getByRole('textbox', { name: 'Name in chat' })
    expect(field).toHaveValue('school_logo')
    const helper = screen.getByText(
      'Type {{school_logo}} in the chat, or pick it from + › Add asset.'
    )
    expect(field.getAttribute('aria-describedby')).toContain(helper.id)
  })

  it('reports each keystroke as a draft', async () => {
    const onDraftChange = vi.fn()
    render(<ChatNameField value="owl" onDraftChange={onDraftChange} onCommit={() => {}} />)
    await userEvent.type(screen.getByRole('textbox'), 'x')
    expect(onDraftChange).toHaveBeenLastCalledWith('owlx')
  })

  it('commits on Enter and on blur, only when changed', async () => {
    const onCommit = vi.fn()
    render(<ChatNameField value="owl" onCommit={onCommit} />)
    const field = screen.getByRole('textbox')
    await userEvent.click(field)
    await userEvent.tab()
    expect(onCommit).not.toHaveBeenCalled()
    await userEvent.type(field, '_mascot{Enter}')
    expect(onCommit).toHaveBeenCalledWith('owl_mascot')
    await userEvent.type(field, '2')
    await userEvent.tab()
    expect(onCommit).toHaveBeenLastCalledWith('owl_mascot2')
  })

  it('shows the error in place of the helper and marks the field invalid', () => {
    render(
      <ChatNameField
        value="owl"
        onCommit={() => {}}
        error="You already have an asset called owl_mascot."
      />
    )
    expect(screen.getByText('You already have an asset called owl_mascot.')).toBeInTheDocument()
    expect(screen.queryByText(/Type \{\{/)).toBeNull()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('Esc puts the saved name back', async () => {
    render(<ChatNameField value="owl" onCommit={() => {}} />)
    const field = screen.getByRole('textbox')
    await userEvent.type(field, 'zzz{Escape}')
    expect(field).toHaveValue('owl')
  })

  it('follows a new saved name from outside', () => {
    const { rerender } = render(<ChatNameField value="owl" onCommit={() => {}} />)
    rerender(<ChatNameField value="owl_mascot" onCommit={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('owl_mascot')
    expect(screen.getByText(/Type \{\{owl_mascot\}\}/)).toBeInTheDocument()
  })

  it('marks the field busy while a check runs', () => {
    render(<ChatNameField value="owl" onCommit={() => {}} checking />)
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-busy', 'true')
  })
})
