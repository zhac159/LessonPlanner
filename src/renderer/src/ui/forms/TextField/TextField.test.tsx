import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TextField } from './TextField'

describe('TextField', () => {
  it('labels the input and shows the hint linked with aria-describedby', () => {
    render(<TextField label="Your name" hint="Shown on your lessons" />)
    const input = screen.getByLabelText('Your name')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAccessibleDescription('Shown on your lessons')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('types into an uncontrolled field and reports changes', async () => {
    const onChange = vi.fn()
    render(<TextField label="Subject" onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Subject'), 'Maths')
    expect(screen.getByLabelText('Subject')).toHaveValue('Maths')
    expect(onChange).toHaveBeenCalledTimes(5)
  })

  it('works as a controlled field', async () => {
    function Harness() {
      const [v, setV] = useState('')
      return (
        <TextField label="Name" value={v} onChange={(e) => setV(e.target.value.toUpperCase())} />
      )
    }
    render(<Harness />)
    await userEvent.type(screen.getByLabelText('Name'), 'ab')
    expect(screen.getByLabelText('Name')).toHaveValue('AB')
  })

  it('shows the error instead of the hint and marks the field invalid', () => {
    render(<TextField label="API key" hint="Starts with sk-" error="That key looks wrong" />)
    const input = screen.getByLabelText('API key')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('That key looks wrong')
    expect(screen.queryByText('Starts with sk-')).not.toBeInTheDocument()
    expect(input.closest('.fk-field')).toHaveClass('is-invalid')
  })

  it('supports invalid without a message', () => {
    render(<TextField label="Title" invalid />)
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true')
  })

  it('merges a caller aria-describedby with its own message', () => {
    render(
      <>
        <span id="extra">More</span>
        <TextField label="Name" hint="Hint" aria-describedby="extra" />
      </>
    )
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Hint More')
  })

  it('disables the input and styles the box', () => {
    render(<TextField label="Name" disabled />)
    const input = screen.getByLabelText('Name')
    expect(input).toBeDisabled()
    expect(input.closest('.fk-field')).toHaveClass('is-disabled')
  })

  it('can hide the visible label but keeps it as the accessible name', () => {
    render(<TextField label="Learning goal" hideLabel />)
    expect(screen.getByText('Learning goal')).toHaveClass('fk-sr-only')
    expect(screen.getByRole('textbox', { name: 'Learning goal' })).toBeInTheDocument()
  })

  it('renders prefix and suffix inside the field', () => {
    render(<TextField label="Price" prefix={<span>£</span>} suffix={<span>per week</span>} />)
    const box = screen.getByLabelText('Price').closest('.fk-field')!
    expect(box).toHaveTextContent('£')
    expect(box).toHaveTextContent('per week')
  })

  it('shows a spinner and aria-busy while loading', () => {
    render(<TextField label="Name" loading />)
    const input = screen.getByLabelText('Name')
    expect(input).toHaveAttribute('aria-busy', 'true')
    expect(input.closest('.fk-field')!.querySelector('.fk-spin')).not.toBeNull()
  })

  it('forwards the ref and native props', () => {
    const ref = createRef<HTMLInputElement>()
    render(<TextField label="Name" ref={ref} placeholder="e.g. Ms Patel" maxLength={20} />)
    expect(ref.current).toBe(screen.getByPlaceholderText('e.g. Ms Patel'))
    expect(ref.current).toHaveAttribute('maxlength', '20')
  })

  it('applies the size and strong value classes', () => {
    render(<TextField label="Name" size="xl" strongValue />)
    const input = screen.getByLabelText('Name')
    expect(input.closest('.fk-field')).toHaveClass('tf-box--xl')
    expect(input).toHaveClass('tf-input--strong')
  })

  describe('search variant', () => {
    it('is a pill searchbox with the label hidden and a leading icon', () => {
      render(<TextField label="Search lessons and styles" variant="search" />)
      const input = screen.getByRole('searchbox', { name: 'Search lessons and styles' })
      const box = input.closest('.fk-field')!
      expect(box).toHaveClass('tf-box--md')
      expect(box.querySelector('svg')).not.toBeNull()
      expect(screen.getByText('Search lessons and styles')).toHaveClass('fk-sr-only')
    })
  })

  describe('password variant', () => {
    it('masks the value and toggles with Show / Hide', async () => {
      render(<TextField label="API key" variant="password" defaultValue="sk-secret" />)
      const input = screen.getByLabelText('API key')
      expect(input).toHaveAttribute('type', 'password')
      expect(input).toHaveClass('tf-input--masked')

      const toggle = screen.getByRole('button', { name: 'Show' })
      expect(toggle).toHaveAttribute('aria-pressed', 'false')
      await userEvent.click(toggle)
      expect(input).toHaveAttribute('type', 'text')
      expect(input).not.toHaveClass('tf-input--masked')
      const hide = screen.getByRole('button', { name: 'Hide' })
      expect(hide).toHaveAttribute('aria-pressed', 'true')
      await userEvent.click(hide)
      expect(input).toHaveAttribute('type', 'password')
    })

    it('does not submit a surrounding form when toggling', async () => {
      const onSubmit = vi.fn((e) => e.preventDefault())
      render(
        <form onSubmit={onSubmit}>
          <TextField label="API key" variant="password" />
        </form>
      )
      await userEvent.click(screen.getByRole('button', { name: 'Show' }))
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('disables the toggle with the field', () => {
      render(<TextField label="API key" variant="password" disabled />)
      expect(screen.getByRole('button', { name: 'Show' })).toBeDisabled()
    })
  })

  describe('title variant', () => {
    it('hides the label and shows the pencil', () => {
      render(<TextField label="Lesson title" variant="title" placeholder="Untitled lesson" />)
      const input = screen.getByPlaceholderText('Untitled lesson')
      expect(input.closest('.fk-field')).toHaveClass('tf-box--title')
      expect(input.closest('.fk-field')!.querySelector('svg')).not.toBeNull()
      expect(screen.getByText('Lesson title')).toHaveClass('fk-sr-only')
    })
  })
})
