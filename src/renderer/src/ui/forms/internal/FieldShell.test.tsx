import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FieldShell } from './FieldShell'
import { describedBy, type FieldIds } from './useFieldIds'

const ids: FieldIds = { id: 'f', hintId: 'f-hint', errorId: 'f-error' }

describe('FieldShell', () => {
  it('renders the label bound to the control id, then the control', () => {
    render(
      <FieldShell ids={ids} label="Name">
        <input id="f" />
      </FieldShell>
    )
    expect(screen.getByLabelText('Name')).toBe(document.getElementById('f'))
  })

  it('shows the hint when there is no error', () => {
    render(
      <FieldShell ids={ids} label="Name" hint="Help me">
        <input id="f" />
      </FieldShell>
    )
    expect(screen.getByText('Help me')).toHaveAttribute('id', 'f-hint')
  })

  it('shows the error with an icon instead of the hint', () => {
    render(
      <FieldShell ids={ids} label="Name" hint="Help me" error="Bad">
        <input id="f" />
      </FieldShell>
    )
    expect(screen.queryByText('Help me')).not.toBeInTheDocument()
    const error = screen.getByText('Bad').closest('p')!
    expect(error).toHaveAttribute('id', 'f-error')
    expect(error.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('hides the label visually, and supports the inline layout and strong label', () => {
    render(
      <FieldShell ids={ids} label="Sort" hideLabel strongLabel labelPosition="inline">
        <input id="f" />
      </FieldShell>
    )
    const label = screen.getByText('Sort')
    expect(label).toHaveClass('fk-sr-only', 'fk-label--strong', 'fk-label--inline')
  })
})

describe('describedBy', () => {
  it('prefers the error over the hint and appends extra ids', () => {
    expect(describedBy(ids, { hint: 'h', error: 'e' })).toBe('f-error')
    expect(describedBy(ids, { hint: 'h' }, 'x')).toBe('f-hint x')
    expect(describedBy(ids, {}, 'x')).toBe('x')
  })
  it('is undefined when there is nothing to describe', () => {
    expect(describedBy(ids, {})).toBeUndefined()
  })
})
