import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NumberStepper, type NumberStepperProps } from './NumberStepper'

const base: NumberStepperProps = {
  label: 'How many questions?',
  min: 3,
  max: 30,
  decrementLabel: 'Fewer questions',
  incrementLabel: 'More questions'
}

function setup(props: Partial<NumberStepperProps> = {}) {
  const onChange = vi.fn()
  render(<NumberStepper {...base} defaultValue={10} onChange={onChange} {...props} />)
  return { onChange, input: screen.getByRole('spinbutton', { name: 'How many questions?' }) }
}

describe('NumberStepper', () => {
  it('is a spinbutton with the label, value and limits exposed', () => {
    const { input } = setup()
    expect(input).toHaveValue(10)
    expect(input).toHaveAttribute('aria-valuenow', '10')
    expect(input).toHaveAttribute('aria-valuemin', '3')
    expect(input).toHaveAttribute('aria-valuemax', '30')
    expect(screen.getByRole('button', { name: 'Fewer questions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More questions' })).toBeInTheDocument()
  })

  it('starts at min when no value is given', () => {
    render(<NumberStepper {...base} />)
    expect(screen.getByRole('spinbutton')).toHaveValue(3)
  })

  it('steps with the buttons', async () => {
    const { onChange, input } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'More questions' }))
    await userEvent.click(screen.getByRole('button', { name: 'More questions' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fewer questions' }))
    expect(input).toHaveValue(11)
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([11, 12, 11])
  })

  it('disables the buttons at the limits', async () => {
    setup({ defaultValue: 3 })
    expect(screen.getByRole('button', { name: 'Fewer questions' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'More questions' }))
    expect(screen.getByRole('button', { name: 'Fewer questions' })).toBeEnabled()
  })

  it('disables the plus button at max', () => {
    setup({ defaultValue: 30 })
    expect(screen.getByRole('button', { name: 'More questions' })).toBeDisabled()
  })

  it('uses Up/Down for ±1, PageUp/PageDown for ±5 and Home/End for min/max', async () => {
    const { input, onChange } = setup()
    input.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(input).toHaveValue(11)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(input).toHaveValue(9)
    await userEvent.keyboard('{PageUp}')
    expect(input).toHaveValue(14)
    await userEvent.keyboard('{PageDown}{PageDown}')
    expect(input).toHaveValue(4)
    await userEvent.keyboard('{PageDown}')
    expect(input).toHaveValue(3)
    await userEvent.keyboard('{End}')
    expect(input).toHaveValue(30)
    await userEvent.keyboard('{Home}')
    expect(input).toHaveValue(3)
    expect(onChange).toHaveBeenLastCalledWith(3)
  })

  it('ignores Home/End when there is no bound', async () => {
    render(<NumberStepper label="Count" defaultValue={5} />)
    const input = screen.getByRole('spinbutton')
    input.focus()
    await userEvent.keyboard('{Home}{End}')
    expect(input).toHaveValue(5)
  })

  it('honours step and pageStep', async () => {
    const { input } = setup({ step: 2, pageStep: 10, defaultValue: 10 })
    input.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(input).toHaveValue(12)
    await userEvent.keyboard('{PageUp}')
    expect(input).toHaveValue(22)
  })

  it('lets the user type freely and clamps when the box loses focus', async () => {
    const { input, onChange } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '1')
    expect(input).toHaveValue(1)
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.tab()
    expect(input).toHaveValue(3)
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('commits a typed in-range number straight away', async () => {
    const { input, onChange } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '15')
    expect(onChange).toHaveBeenLastCalledWith(15)
  })

  it('clamps a typed number above max on blur', async () => {
    const { input } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '99')
    await userEvent.tab()
    expect(input).toHaveValue(30)
  })

  it('restores the last value when left empty', async () => {
    const { input, onChange } = setup()
    await userEvent.clear(input)
    await userEvent.tab()
    expect(input).toHaveValue(10)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('works controlled', async () => {
    function Harness() {
      const [n, setN] = useState(5)
      return <NumberStepper {...base} value={n} onChange={setN} />
    }
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'More questions' }))
    expect(screen.getByRole('spinbutton')).toHaveValue(6)
  })

  it('does not change when a controlled parent refuses', async () => {
    render(<NumberStepper {...base} value={5} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'More questions' }))
    expect(screen.getByRole('spinbutton')).toHaveValue(5)
  })

  it('is inert when disabled', async () => {
    const { input, onChange } = setup({ disabled: true })
    expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'More questions' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Fewer questions' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'More questions' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('falls back to generic button names', () => {
    render(<NumberStepper label="Count" />)
    expect(screen.getByRole('button', { name: 'Decrease' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Increase' })).toBeInTheDocument()
  })
})
