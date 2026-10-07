import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RadioCard, RadioCardGroup } from './RadioCard'

const PLACES = [
  { value: 'new', label: 'A new slide', description: 'Added after the current slide' },
  { value: 'notes', label: 'Speaker notes' },
  {
    value: 'replace',
    label: 'Replace this slide',
    description: 'Keeps a copy in undo',
    disabled: true
  }
]

describe('RadioCard', () => {
  it('names the radio from the title and describes it from the description', () => {
    render(
      <RadioCard name="x" value="a" label="A new slide" description="After the current slide" />
    )
    const radio = screen.getByRole('radio', { name: 'A new slide' })
    expect(radio).toHaveAccessibleDescription('After the current slide')
  })

  it('has no description when none is given', () => {
    render(<RadioCard name="x" value="a" label="Notes" />)
    expect(screen.getByRole('radio', { name: 'Notes' })).not.toHaveAttribute('aria-describedby')
  })

  it('passes native input props through', () => {
    render(<RadioCard name="x" value="a" label="Notes" checked readOnly />)
    expect(screen.getByRole('radio')).toBeChecked()
  })
})

describe('RadioCardGroup', () => {
  it('is a group named by its legend with a card per option', () => {
    render(<RadioCardGroup legend="Where should it go?" options={PLACES} />)
    expect(screen.getByRole('group', { name: 'Where should it go?' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'A new slide' })).toHaveAccessibleDescription(
      'Added after the current slide'
    )
  })

  it('selects when the card (not just the dot) is clicked', async () => {
    const onChange = vi.fn()
    render(<RadioCardGroup legend="Where?" options={PLACES} onChange={onChange} />)
    await userEvent.click(screen.getByText('Added after the current slide'))
    expect(screen.getByRole('radio', { name: 'A new slide' })).toBeChecked()
    await userEvent.click(screen.getByText('Speaker notes'))
    expect(onChange.mock.calls).toEqual([['new'], ['notes']])
  })

  it('supports arrow keys and skips disabled cards', async () => {
    render(<RadioCardGroup legend="Where?" options={PLACES} defaultValue="new" />)
    screen.getByRole('radio', { name: 'A new slide' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'Speaker notes' })).toBeChecked()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'A new slide' })).toBeChecked()
  })

  it('is controllable', async () => {
    function Harness() {
      const [v, setV] = useState('notes')
      return <RadioCardGroup legend="Where?" options={PLACES} value={v} onChange={setV} />
    }
    render(<Harness />)
    expect(screen.getByRole('radio', { name: 'Speaker notes' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: 'A new slide' }))
    expect(screen.getByRole('radio', { name: 'A new slide' })).toBeChecked()
  })

  it('does not select disabled cards', async () => {
    const onChange = vi.fn()
    render(<RadioCardGroup legend="Where?" options={PLACES} onChange={onChange} />)
    expect(screen.getByRole('radio', { name: 'Replace this slide' })).toBeDisabled()
    await userEvent.click(screen.getByText('Replace this slide'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
