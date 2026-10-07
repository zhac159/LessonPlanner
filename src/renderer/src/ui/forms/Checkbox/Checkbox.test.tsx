import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from './Checkbox'
import { CheckboxGroup } from './CheckboxGroup'

describe('Checkbox', () => {
  it('is a checkbox named by its label text', () => {
    render(<Checkbox label="Make this my default style" />)
    expect(screen.getByRole('checkbox', { name: 'Make this my default style' })).not.toBeChecked()
  })

  it('toggles when uncontrolled and reports the boolean', async () => {
    const onChange = vi.fn()
    render(<Checkbox label="Multiple choice" onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Multiple choice'))
    expect(screen.getByLabelText('Multiple choice')).toBeChecked()
    await userEvent.click(screen.getByText('Multiple choice'))
    expect(screen.getByLabelText('Multiple choice')).not.toBeChecked()
    expect(onChange.mock.calls).toEqual([[true], [false]])
  })

  it('honours defaultChecked', () => {
    render(<Checkbox label="A" defaultChecked />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('works controlled', async () => {
    function Harness() {
      const [on, setOn] = useState(true)
      return <Checkbox label="Short answer" checked={on} onChange={setOn} />
    }
    render(<Harness />)
    expect(screen.getByRole('checkbox')).toBeChecked()
    await userEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('toggles with the Space key', async () => {
    render(<Checkbox label="Key" />)
    await userEvent.tab()
    await userEvent.keyboard(' ')
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('shows the indeterminate state and clears it when toggled', async () => {
    const onChange = vi.fn()
    render(<Checkbox label="All types" indeterminate onChange={onChange} />)
    const box = screen.getByRole('checkbox')
    expect(box).toBePartiallyChecked()
    await userEvent.click(box)
    expect(onChange).toHaveBeenCalledWith(true)
    expect(box).not.toBePartiallyChecked()
  })

  it('is inert when disabled', async () => {
    const onChange = vi.fn()
    render(<Checkbox label="Locked" disabled onChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('supports the emphasis row and forwards the ref', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Checkbox label="Default" emphasis ref={ref} />)
    expect(ref.current).toBe(screen.getByRole('checkbox'))
    expect(screen.getByRole('checkbox').closest('label')).toHaveClass('cb--emphasis')
  })
})

describe('CheckboxGroup', () => {
  it('is a group named by its legend', () => {
    render(
      <CheckboxGroup legend="Question types">
        <Checkbox label="Multiple choice" />
        <Checkbox label="Short answer" />
      </CheckboxGroup>
    )
    const group = screen.getByRole('group', { name: 'Question types' })
    expect(group.querySelectorAll('input[type=checkbox]')).toHaveLength(2)
  })

  it('disables every checkbox with the fieldset', () => {
    render(
      <CheckboxGroup legend="Types" disabled>
        <Checkbox label="One" />
      </CheckboxGroup>
    )
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('can hide its legend visually', () => {
    render(
      <CheckboxGroup legend="Types" hideLegend>
        <Checkbox label="One" />
      </CheckboxGroup>
    )
    expect(screen.getByText('Types')).toHaveClass('fk-sr-only')
  })
})
