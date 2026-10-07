import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SelectChip, type SelectChipProps } from './SelectChip'

const STYLES = [
  { value: 'sci', label: 'Science KS3', fill: 'var(--tone-style)' },
  { value: 'maths', label: 'Maths' },
  { value: 'music', label: 'Music' },
  { value: 'old', label: 'Old style', disabled: true },
  { value: 'eng', label: 'English' }
]

function setup(props: Partial<SelectChipProps> = {}) {
  const onChange = vi.fn()
  const utils = render(
    <SelectChip label="Style" options={STYLES} defaultValue="sci" onChange={onChange} {...props} />
  )
  const chip = () => screen.getByRole('button', { name: /^Style:/ })
  return { onChange, chip, ...utils }
}

const optionNames = () => screen.getAllByRole('option').map((o) => o.textContent)

describe('SelectChip', () => {
  it('is named after the setting and its value, with listbox semantics', () => {
    const { chip } = setup()
    expect(chip()).toHaveAccessibleName('Style: Science KS3. Change style')
    expect(chip()).toHaveAttribute('aria-haspopup', 'listbox')
    expect(chip()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows the placeholder when nothing is selected', () => {
    render(<SelectChip label="Lesson length" options={STYLES} placeholder="Pick one" />)
    expect(screen.getByRole('button')).toHaveAccessibleName(
      'Lesson length: Pick one. Change lesson length'
    )
    expect(screen.getByRole('button')).toHaveTextContent('Pick one')
  })

  it('opens a listbox on click and marks the selected option', async () => {
    const { chip } = setup()
    await userEvent.click(chip())
    expect(chip()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox', { name: 'Style' })).toBeInTheDocument()
    expect(optionNames()).toEqual(['Science KS3', 'Maths', 'Music', 'Old style', 'English'])
    expect(screen.getByRole('option', { name: 'Science KS3' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('option', { name: 'Maths' })).toHaveAttribute('aria-selected', 'false')
    expect(chip()).toHaveAttribute('aria-controls', screen.getByRole('listbox').id)
  })

  it('moves focus to the listbox and points aria-activedescendant at the selected option', async () => {
    const { chip } = setup()
    await userEvent.click(chip())
    const list = screen.getByRole('listbox')
    expect(list).toHaveFocus()
    expect(list).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Science KS3' }).id
    )
  })

  it('selects with a click, closes, updates the chip and returns focus', async () => {
    const { chip, onChange } = setup()
    await userEvent.click(chip())
    await userEvent.click(screen.getByRole('option', { name: 'Maths' }))
    expect(onChange).toHaveBeenCalledWith('maths')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(chip()).toHaveAccessibleName('Style: Maths. Change style')
    expect(chip()).toHaveFocus()
  })

  it('does not call onChange when the same value is chosen again', async () => {
    const { chip, onChange } = setup()
    await userEvent.click(chip())
    await userEvent.click(screen.getByRole('option', { name: 'Science KS3' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes when the chip is clicked again', async () => {
    const { chip } = setup()
    await userEvent.click(chip())
    await userEvent.click(chip())
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens with ArrowDown and ArrowUp on the chip', async () => {
    const { chip } = setup()
    chip().focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('opens with Enter and Space on the chip', async () => {
    const { chip } = setup()
    chip().focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard(' ')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  describe('keyboard in the listbox', () => {
    const activeName = () => {
      const id = screen.getByRole('listbox').getAttribute('aria-activedescendant')
      return document.getElementById(id!)?.textContent
    }

    it('moves with Up/Down, skipping disabled options, without wrapping', async () => {
      const { chip } = setup({ defaultValue: 'maths' })
      await userEvent.click(chip())
      expect(activeName()).toBe('Maths')
      await userEvent.keyboard('{ArrowDown}')
      expect(activeName()).toBe('Music')
      await userEvent.keyboard('{ArrowDown}')
      expect(activeName()).toBe('English')
      await userEvent.keyboard('{ArrowDown}')
      expect(activeName()).toBe('English')
      await userEvent.keyboard('{ArrowUp}{ArrowUp}')
      expect(activeName()).toBe('Maths')
    })

    it('jumps with Home and End', async () => {
      const { chip } = setup({ defaultValue: 'music' })
      await userEvent.click(chip())
      await userEvent.keyboard('{End}')
      expect(activeName()).toBe('English')
      await userEvent.keyboard('{Home}')
      expect(activeName()).toBe('Science KS3')
    })

    it('selects the active option with Enter', async () => {
      const { chip, onChange } = setup()
      await userEvent.click(chip())
      await userEvent.keyboard('{ArrowDown}{Enter}')
      expect(onChange).toHaveBeenCalledWith('maths')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(chip()).toHaveFocus()
    })

    it('selects the active option with Space and does not reopen', async () => {
      const { chip, onChange } = setup()
      await userEvent.click(chip())
      await userEvent.keyboard('{ArrowDown}{ArrowDown} ')
      expect(onChange).toHaveBeenCalledWith('music')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('closes on Escape and returns focus to the chip without changing anything', async () => {
      const { chip, onChange } = setup()
      await userEvent.click(chip())
      await userEvent.keyboard('{ArrowDown}{Escape}')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(chip()).toHaveFocus()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('closes on Tab and keeps focus on the chip so the Tab continues from it', async () => {
      const { chip } = setup()
      await userEvent.click(chip())
      await userEvent.keyboard('{Tab}')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('jumps by type-ahead', async () => {
      const { chip } = setup()
      await userEvent.click(chip())
      await userEvent.keyboard('e')
      expect(activeName()).toBe('English')
      await userEvent.keyboard('{Escape}')
      await userEvent.click(chip())
      await userEvent.keyboard('mu')
      expect(activeName()).toBe('Music')
    })

    it('ignores type-ahead for disabled options and unknown letters', async () => {
      const { chip } = setup()
      await userEvent.click(chip())
      await userEvent.keyboard('o')
      expect(activeName()).toBe('Science KS3')
      await userEvent.keyboard('z')
      expect(activeName()).toBe('Science KS3')
    })

    it('hover makes an option active', async () => {
      const { chip } = setup()
      await userEvent.click(chip())
      await userEvent.hover(screen.getByRole('option', { name: 'English' }))
      expect(activeName()).toBe('English')
    })
  })

  it('does not select disabled options', async () => {
    const { chip, onChange } = setup()
    await userEvent.click(chip())
    const old = screen.getByRole('option', { name: 'Old style' })
    expect(old).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(old)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('closes on an outside click without restoring focus', async () => {
    const { chip } = setup()
    render(<button>elsewhere</button>)
    await userEvent.click(chip())
    await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'elsewhere' })).toHaveFocus()
  })

  it('closes when the window is resized or the page scrolls, but not when the list scrolls', async () => {
    const { chip } = setup()
    await userEvent.click(chip())
    fireEvent.scroll(screen.getByRole('listbox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    act(() => {
      fireEvent.scroll(document)
    })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await userEvent.click(chip())
    act(() => {
      fireEvent(window, new Event('resize'))
    })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('works controlled', async () => {
    function Harness() {
      const [v, setV] = useState('maths')
      return <SelectChip label="Style" options={STYLES} value={v} onChange={setV} />
    }
    render(<Harness />)
    expect(screen.getByRole('button')).toHaveTextContent('Maths')
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByRole('option', { name: 'English' }))
    expect(screen.getByRole('button')).toHaveTextContent('English')
  })

  it('keeps showing the controlled value when the parent does not update it', async () => {
    render(<SelectChip label="Style" options={STYLES} value="maths" onChange={() => {}} />)
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByRole('option', { name: 'English' }))
    expect(screen.getByRole('button')).toHaveTextContent('Maths')
  })

  it('takes its fill from the selected option and a leading element from props or the option', () => {
    const { chip } = setup({ leading: <i data-testid="timer" /> })
    expect(chip().style.getPropertyValue('--sc-fill')).toBe('var(--tone-style)')
    expect(screen.getByTestId('timer')).toBeInTheDocument()
  })

  it('shows the selected option leading element on the chip and in the menu', async () => {
    const options = [{ value: 'a', label: 'A', leading: <i data-testid="dot" /> }]
    render(<SelectChip label="Style" options={options} defaultValue="a" />)
    expect(screen.getAllByTestId('dot')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getAllByTestId('dot')).toHaveLength(2)
  })

  it('does not open when disabled', async () => {
    const { chip } = setup({ disabled: true })
    expect(chip()).toBeDisabled()
    await userEvent.click(chip())
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('supports the sm size and exposes the full value as a title', () => {
    const { chip } = setup({ size: 'sm' })
    expect(chip()).toHaveClass('sc__chip--sm')
    expect(screen.getByTitle('Science KS3')).toBeInTheDocument()
  })

  it('keeps the chevron and expanded state in sync with the menu', async () => {
    const { chip } = setup()
    await userEvent.click(chip())
    expect(chip()).toHaveClass('is-open')
    await userEvent.keyboard('{Escape}')
    expect(chip()).not.toHaveClass('is-open')
    expect(chip()).toHaveAttribute('aria-expanded', 'false')
  })
})
