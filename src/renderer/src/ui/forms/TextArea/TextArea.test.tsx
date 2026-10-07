import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TextArea } from './TextArea'

describe('TextArea', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has an accessible name, a hint and four rows by default', () => {
    render(<TextArea label="Learning objectives" hint="One per line" />)
    const area = screen.getByRole('textbox', { name: 'Learning objectives' })
    expect(area).toHaveAttribute('rows', '4')
    expect(area).toHaveAccessibleDescription('One per line')
  })

  it('can hide the label visually', () => {
    render(<TextArea label="Learning objectives" hideLabel />)
    expect(screen.getByText('Learning objectives')).toHaveClass('fk-sr-only')
  })

  it('accepts typing and reports changes (uncontrolled)', async () => {
    const onChange = vi.fn()
    render(<TextArea label="Notes" onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Notes'), 'a{Enter}b')
    expect(screen.getByLabelText('Notes')).toHaveValue('a\nb')
    expect(onChange).toHaveBeenCalled()
  })

  it('works controlled', async () => {
    function Harness() {
      const [v, setV] = useState('')
      return <TextArea label="Notes" value={v} onChange={(e) => setV(e.target.value.slice(0, 3))} />
    }
    render(<Harness />)
    await userEvent.type(screen.getByLabelText('Notes'), 'abcdef')
    expect(screen.getByLabelText('Notes')).toHaveValue('abc')
  })

  it('shows an error message and marks the field invalid', () => {
    render(<TextArea label="Notes" error="Add at least one objective" />)
    const area = screen.getByLabelText('Notes')
    expect(area).toHaveAttribute('aria-invalid', 'true')
    expect(area).toHaveAccessibleDescription('Add at least one objective')
    expect(area).toHaveClass('is-invalid')
  })

  it('disables the field', () => {
    render(<TextArea label="Notes" disabled />)
    expect(screen.getByLabelText('Notes')).toBeDisabled()
    expect(screen.getByLabelText('Notes')).toHaveClass('is-disabled')
  })

  it('forwards the ref', () => {
    const ref = createRef<HTMLTextAreaElement>()
    render(<TextArea label="Notes" ref={ref} />)
    expect(ref.current).toBe(screen.getByLabelText('Notes'))
  })

  describe('autoGrow', () => {
    it('sizes itself to its content as the user types', async () => {
      const spy = vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get')
      spy.mockReturnValue(123)
      render(<TextArea label="Notes" autoGrow />)
      const area = screen.getByLabelText('Notes')
      expect(area).toHaveClass('ta--auto')
      expect(area.style.height).toBe('123px')
      spy.mockReturnValue(200)
      await userEvent.type(area, 'x')
      expect(area.style.height).toBe('200px')
    })

    it('re-fits when the controlled value changes from outside', () => {
      const spy = vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get')
      spy.mockReturnValue(80)
      const { rerender } = render(<TextArea label="Notes" autoGrow value="a" onChange={() => {}} />)
      spy.mockReturnValue(160)
      rerender(<TextArea label="Notes" autoGrow value={'a\n'.repeat(5)} onChange={() => {}} />)
      expect(screen.getByLabelText('Notes').style.height).toBe('160px')
    })

    it('leaves the height alone when autoGrow is off', async () => {
      vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(99)
      render(<TextArea label="Notes" />)
      await userEvent.type(screen.getByLabelText('Notes'), 'x')
      expect(screen.getByLabelText('Notes').style.height).toBe('')
    })
  })
})
