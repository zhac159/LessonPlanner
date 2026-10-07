import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MessageAssistant } from './MessageAssistant'

describe('MessageAssistant', () => {
  it('shows an optional heading and the text', () => {
    render(<MessageAssistant heading="What are we teaching?" text="Paste your objectives." />)
    expect(screen.getByRole('heading', { name: 'What are we teaching?' })).toBeInTheDocument()
    expect(screen.getByText('Paste your objectives.')).toBeInTheDocument()
  })

  it('renders paragraphs, bullets and bold, but never HTML', () => {
    const { container } = render(
      <MessageAssistant text={'Made **8 slides**:\n- Do Now\n- Plenary\n\n<img src=x>'} />
    )
    expect(container.querySelector('strong')).toHaveTextContent('8 slides')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Do Now',
      'Plenary'
    ])
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('<img src=x>')).toBeInTheDocument()
  })

  it('marks the text as streaming with a caret and aria-busy', () => {
    const { container } = render(<MessageAssistant text="Thinking about" streaming />)
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.ui-msg-a__text')).toHaveAttribute('data-streaming', 'true')
  })

  it('shows the caret even before the first word arrives', () => {
    const { container } = render(<MessageAssistant streaming />)
    expect(container.querySelector('.ui-msg-a__text')).toHaveAttribute('data-streaming', 'true')
  })

  it('is not busy when finished', () => {
    const { container } = render(<MessageAssistant text="Done" />)
    expect(container.firstElementChild).not.toHaveAttribute('aria-busy')
    expect(container.querySelector('[data-streaming]')).toBeNull()
  })

  it('renders nothing for the text area when there is no text', () => {
    const { container } = render(<MessageAssistant>child</MessageAssistant>)
    expect(container.querySelector('.ui-msg-a__text')).toBeNull()
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('shows the error style with a single Try again action', async () => {
    const onClick = vi.fn()
    const { container } = render(
      <MessageAssistant
        variant="error"
        text="I couldn’t make that change cleanly. Nothing was changed."
        action={{ label: 'Try again', onClick }}
      />
    )
    expect(container.firstElementChild).toHaveAttribute('data-variant', 'error')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows what follows the text (result chip, files)', () => {
    render(
      <MessageAssistant text="Done!">
        <span>8 slides added</span>
      </MessageAssistant>
    )
    expect(screen.getByText('8 slides added')).toBeInTheDocument()
  })
})
