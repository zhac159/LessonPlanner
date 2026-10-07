import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'

const MODELS = [
  { value: 'sonnet', label: 'Claude Sonnet' },
  { value: 'opus', label: 'Claude Opus' },
  { value: 'haiku', label: 'Claude Haiku', disabled: true }
]

describe('Select', () => {
  it('is a combobox named by its label with all options', () => {
    render(<Select label="Model" options={MODELS} />)
    const select = screen.getByRole('combobox', { name: 'Model' })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Claude Sonnet',
      'Claude Opus',
      'Claude Haiku'
    ])
    expect(select).toHaveValue('sonnet')
  })

  it('calls onChange with the chosen value (uncontrolled)', async () => {
    const onChange = vi.fn()
    render(<Select label="Model" options={MODELS} onChange={onChange} />)
    await userEvent.selectOptions(screen.getByLabelText('Model'), 'opus')
    expect(onChange).toHaveBeenCalledWith('opus', expect.anything())
    expect(screen.getByLabelText('Model')).toHaveValue('opus')
  })

  it('works controlled: the value only changes when the parent says so', async () => {
    function Harness({ lock }: { lock?: boolean }) {
      const [v, setV] = useState('sonnet')
      return <Select label="Model" options={MODELS} value={v} onChange={(n) => !lock && setV(n)} />
    }
    const { unmount } = render(<Harness />)
    await userEvent.selectOptions(screen.getByLabelText('Model'), 'opus')
    expect(screen.getByLabelText('Model')).toHaveValue('opus')
    unmount()
    render(<Harness lock />)
    await userEvent.selectOptions(screen.getByLabelText('Model'), 'opus')
    expect(screen.getByLabelText('Model')).toHaveValue('sonnet')
  })

  it('shows a disabled placeholder until something is chosen', async () => {
    render(<Select label="Sort" options={MODELS} placeholder="Choose…" />)
    const select = screen.getByLabelText('Sort')
    expect(select).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Choose…' })).toBeDisabled()
    await userEvent.selectOptions(select, 'sonnet')
    expect(select).toHaveValue('sonnet')
  })

  it('marks disabled options', () => {
    render(<Select label="Model" options={MODELS} />)
    expect(screen.getByRole('option', { name: 'Claude Haiku' })).toBeDisabled()
  })

  it('links the hint, and shows the error with aria-invalid instead', () => {
    const { rerender } = render(<Select label="Model" options={MODELS} hint="Pick one" />)
    expect(screen.getByLabelText('Model')).toHaveAccessibleDescription('Pick one')
    rerender(<Select label="Model" options={MODELS} hint="Pick one" error="Required" />)
    const select = screen.getByLabelText('Model')
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAccessibleDescription('Required')
    expect(select).toHaveClass('is-invalid')
  })

  it('disables the control', () => {
    render(<Select label="Model" options={MODELS} disabled />)
    expect(screen.getByLabelText('Model')).toBeDisabled()
  })

  it('supports an inline label and the sm size', () => {
    render(<Select label="Sort" options={MODELS} labelPosition="inline" size="sm" />)
    expect(screen.getByText('Sort')).toHaveClass('fk-label--inline')
    expect(screen.getByLabelText('Sort').parentElement).toHaveClass('sel--sm')
  })

  it('can hide the label visually', () => {
    render(<Select label="Sort" options={MODELS} hideLabel />)
    expect(screen.getByText('Sort')).toHaveClass('fk-sr-only')
  })
})
