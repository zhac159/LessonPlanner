import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CorrectionBox, type CorrectionBoxProps } from './CorrectionBox'

function Harness(props: Partial<CorrectionBoxProps> & { initial?: string }) {
  const { initial = '', ...rest } = props
  const [value, setValue] = useState(initial)
  return <CorrectionBox value={value} onChange={setValue} onSubmit={() => {}} {...rest} />
}

const field = () => screen.getByRole('textbox', { name: 'Anything I got wrong?' })

afterEach(() => vi.useRealTimers())

describe('CorrectionBox', () => {
  it('shows the label, the placeholder and a disabled "Tell me" while the field is empty', () => {
    render(<Harness />)
    expect(screen.getByRole('form', { name: 'Anything I got wrong?' })).toBeInTheDocument()
    expect(field()).toHaveAttribute('placeholder', 'e.g. I never use yellow on title slides')
    expect(screen.getByRole('button', { name: 'Tell me' })).toBeDisabled()
  })

  it('keeps "Tell me" disabled for whitespace only, and enables it for real text', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(field(), '   ')
    expect(screen.getByRole('button', { name: 'Tell me' })).toBeDisabled()
    await user.type(field(), 'No yellow')
    expect(screen.getByRole('button', { name: 'Tell me' })).toBeEnabled()
  })

  it('submits the trimmed text on click', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} initial="  I never use yellow  " />)
    await user.click(screen.getByRole('button', { name: 'Tell me' }))
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('I never use yellow')
  })

  it('submits once on Enter and once on Ctrl+Enter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} initial="No yellow" />)
    await user.click(field())
    await user.keyboard('{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('does not submit an empty field with the keyboard', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)
    await user.click(field())
    await user.keyboard('{Control>}{Enter}{/Control}{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('is busy: field disabled, button reads "Updating…" and cannot submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness busy initial="No yellow" onSubmit={onSubmit} />)
    expect(field()).toBeDisabled()
    const button = screen.getByRole('button', { name: 'Updating…' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows an error under the box and keeps the typed text', () => {
    render(<Harness initial="No yellow" error="I couldn’t reach Claude." />)
    expect(screen.getByText('I couldn’t reach Claude.')).toBeInTheDocument()
    expect(field()).toHaveValue('No yellow')
    expect(field()).toHaveAttribute('aria-invalid', 'true')
  })

  it('announces the confirmation in a live region and hides it after four seconds', () => {
    vi.useFakeTimers()
    render(<Harness confirmation="Got it: title slides won’t use the yellow box." />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Got it: title slides won’t use the yellow box.')
    act(() => {
      vi.advanceTimersByTime(3999)
    })
    expect(status).toHaveTextContent('Got it')
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(status).toBeEmptyDOMElement()
  })

  it('keeps an empty live region when there is no confirmation', () => {
    render(<Harness />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('has no corrections disclosure without past corrections', () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: /Your corrections/ })).toBeNull()
  })

  it('lists past corrections newest first behind a "Your corrections (n)" disclosure', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        corrections={[
          { text: 'No yellow on titles', at: '2026-10-01T09:00:00Z' },
          { text: 'British spelling only', at: '2026-10-05T09:00:00Z' }
        ]}
      />
    )
    const toggle = screen.getByRole('button', { name: 'Your corrections (2)' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list')).toBeNull()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('British spelling only')
    expect(items[1]).toHaveTextContent('No yellow on titles')
    expect(items[0].querySelector('time')).toHaveAttribute('datetime', '2026-10-05T09:00:00Z')
  })
})
