import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RadioPill, RadioPillGroup } from './RadioPill'

const SLIDES = [
  { value: 'all', label: 'All slides' },
  { value: 'current', label: 'This slide' },
  { value: 'selected', label: 'Selected slides', disabled: true },
  { value: 'new', label: 'New slides' }
]

describe('RadioPill', () => {
  it('is a radio named by its text', () => {
    render(<RadioPill name="x" value="a" label="Easy" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Easy' })).not.toBeChecked()
  })

  it('passes native input props through', () => {
    render(<RadioPill name="x" value="a" label="Easy" checked disabled readOnly />)
    expect(screen.getByRole('radio')).toBeChecked()
    expect(screen.getByRole('radio')).toBeDisabled()
  })
})

describe('RadioPillGroup', () => {
  it('is a group named by its legend with one radio per option', () => {
    render(<RadioPillGroup legend="Which slides?" options={SLIDES} />)
    expect(screen.getByRole('group', { name: 'Which slides?' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(screen.getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true)
  })

  it('selects on click and reports the value (uncontrolled)', async () => {
    const onChange = vi.fn()
    render(<RadioPillGroup legend="Which slides?" options={SLIDES} onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: 'This slide' }))
    expect(screen.getByRole('radio', { name: 'This slide' })).toBeChecked()
    await userEvent.click(screen.getByText('New slides'))
    expect(screen.getByRole('radio', { name: 'This slide' })).not.toBeChecked()
    expect(onChange.mock.calls).toEqual([['current'], ['new']])
  })

  it('shares one native name so the browser provides arrow-key navigation', () => {
    render(<RadioPillGroup legend="Which slides?" options={SLIDES} name="slides" />)
    for (const radio of screen.getAllByRole('radio'))
      expect(radio).toHaveAttribute('name', 'slides')
  })

  it('moves the selection with the arrow keys and skips disabled options', async () => {
    const onChange = vi.fn()
    render(
      <RadioPillGroup
        legend="Which slides?"
        options={SLIDES}
        defaultValue="all"
        onChange={onChange}
      />
    )
    screen.getByRole('radio', { name: 'All slides' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'This slide' })).toBeChecked()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'New slides' })).toBeChecked()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'This slide' })).toBeChecked()
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(['current', 'new', 'current'])
  })

  it('is controllable: it only changes when the parent updates value', async () => {
    function Harness({ locked }: { locked?: boolean }) {
      const [v, setV] = useState('all')
      return (
        <RadioPillGroup
          legend="Which slides?"
          options={SLIDES}
          value={v}
          onChange={(n) => !locked && setV(n)}
        />
      )
    }
    const { unmount } = render(<Harness />)
    await userEvent.click(screen.getByRole('radio', { name: 'This slide' }))
    expect(screen.getByRole('radio', { name: 'This slide' })).toBeChecked()
    unmount()
    render(<Harness locked />)
    await userEvent.click(screen.getByRole('radio', { name: 'This slide' }))
    expect(screen.getByRole('radio', { name: 'All slides' })).toBeChecked()
  })

  it('ignores disabled options', async () => {
    const onChange = vi.fn()
    render(<RadioPillGroup legend="Which slides?" options={SLIDES} onChange={onChange} />)
    expect(screen.getByRole('radio', { name: 'Selected slides' })).toBeDisabled()
    await userEvent.click(screen.getByText('Selected slides'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables the whole group', async () => {
    const onChange = vi.fn()
    render(<RadioPillGroup legend="Which slides?" options={SLIDES} disabled onChange={onChange} />)
    await userEvent.click(screen.getByText('All slides'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: 'All slides' })).toBeDisabled()
  })

  it('can hide the legend visually', () => {
    render(<RadioPillGroup legend="Difficulty" hideLegend options={SLIDES} />)
    expect(screen.getByText('Difficulty')).toHaveClass('fk-sr-only')
  })
})
