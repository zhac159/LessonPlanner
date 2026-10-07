import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ToggleChip } from './ToggleChip'
import { ToggleChipGroup } from './ToggleChipGroup'

describe('ToggleChip', () => {
  it('is a button with aria-pressed, off by default', () => {
    render(<ToggleChip>Year 7</ToggleChip>)
    const chip = screen.getByRole('button', { name: 'Year 7' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect(chip).toHaveAttribute('type', 'button')
  })

  it('toggles when uncontrolled and reports the new state', async () => {
    const onPressedChange = vi.fn()
    render(<ToggleChip onPressedChange={onPressedChange}>Year 7</ToggleChip>)
    const chip = screen.getByRole('button')
    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect(onPressedChange.mock.calls).toEqual([[true], [false]])
  })

  it('honours defaultPressed', () => {
    render(<ToggleChip defaultPressed>On</ToggleChip>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('stays as told when controlled', async () => {
    const onPressedChange = vi.fn()
    render(
      <ToggleChip pressed={false} onPressedChange={onPressedChange}>
        Year 8
      </ToggleChip>
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onPressedChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles with Space and Enter', async () => {
    render(<ToggleChip>Year 9</ToggleChip>)
    await userEvent.tab()
    expect(screen.getByRole('button')).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('ignores clicks when disabled', async () => {
    const onPressedChange = vi.fn()
    render(
      <ToggleChip disabled onPressedChange={onPressedChange}>
        Nope
      </ToggleChip>
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onPressedChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('lets a caller click handler veto the toggle', async () => {
    render(<ToggleChip onClick={(e) => e.preventDefault()}>Vetoed</ToggleChip>)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })
})

const YEARS = [
  { value: 'all', label: 'All' },
  { value: '7', label: 'Year 7' },
  { value: '8', label: 'Year 8' },
  { value: 'form', label: 'Form time', disabled: true }
]

describe('ToggleChipGroup', () => {
  it('is a labelled group with the first option pressed', () => {
    render(<ToggleChipGroup label="Filter by year group" options={YEARS} />)
    const group = screen.getByRole('group', { name: 'Filter by year group' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Year 7' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('selects one chip at a time and switches the others off', async () => {
    const onChange = vi.fn()
    render(<ToggleChipGroup label="Filter" options={YEARS} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Year 7' }))
    await userEvent.click(screen.getByRole('button', { name: 'Year 8' }))
    expect(screen.getByRole('button', { name: 'Year 7' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Year 8' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByRole('button', { name: 'Year 8' })).toHaveAttribute('aria-pressed', 'false')
    expect(onChange.mock.calls).toEqual([['7'], ['8'], ['all']])
  })

  it('does nothing when the pressed chip is clicked again', async () => {
    const onChange = vi.fn()
    render(<ToggleChipGroup label="Filter" options={YEARS} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('is controllable', async () => {
    function Harness() {
      const [v, setV] = useState('8')
      return <ToggleChipGroup label="Filter" options={YEARS} value={v} onChange={setV} />
    }
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Year 8' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Year 7' }))
    expect(screen.getByRole('button', { name: 'Year 7' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('supports a defaultValue and disabled options', async () => {
    const onChange = vi.fn()
    render(<ToggleChipGroup label="Filter" options={YEARS} defaultValue="7" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Year 7' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Form time' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
