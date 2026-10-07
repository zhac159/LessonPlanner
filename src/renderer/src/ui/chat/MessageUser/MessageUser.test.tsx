import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MessageUser } from './MessageUser'

describe('MessageUser', () => {
  it('shows her text', () => {
    render(<MessageUser text="Can you build tomorrow’s lesson from these?" />)
    expect(screen.getByText('Can you build tomorrow’s lesson from these?')).toBeInTheDocument()
  })

  it('never renders her text as HTML', () => {
    const { container } = render(<MessageUser text="<b>bold</b>" />)
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText('<b>bold</b>')).toBeInTheDocument()
  })

  it('puts attachments and region chips before the text', () => {
    const { container } = render(
      <MessageUser
        text="Swap this photo."
        attachments={[{ id: 'a', name: 'LOs.docx' }]}
        regions={[{ id: 'r', n: 1, slideNumber: 3 }]}
      />
    )
    const kids = Array.from(container.firstElementChild?.children ?? [])
    expect(kids[0]).toHaveAttribute('aria-label', 'LOs.docx')
    expect(kids[1]).toHaveClass('ui-region')
    expect(kids[2]).toHaveTextContent('Swap this photo.')
  })

  it('uses the tighter gap when it holds only chips and text', () => {
    const { container, rerender } = render(
      <MessageUser text="x" regions={[{ id: 'r', n: 1, slideNumber: 3 }]} />
    )
    expect(container.firstElementChild).toHaveAttribute('data-compact', 'true')
    rerender(
      <MessageUser
        text="x"
        attachments={[{ id: 'a', name: 'a.pdf' }]}
        regions={[{ id: 'r', n: 1, slideNumber: 3 }]}
      />
    )
    expect(container.firstElementChild).not.toHaveAttribute('data-compact')
  })

  it('lets a region chip jump to its slide', async () => {
    const onClick = vi.fn()
    render(<MessageUser regions={[{ id: 'r', n: 1, slideNumber: 3, onClick }]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Region 1 on slide 3' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows the set-up note under the text', () => {
    render(<MessageUser text="Photosynthesis" note="Year 8 · 50 min" />)
    expect(screen.getByText('Year 8 · 50 min')).toBeInTheDocument()
  })

  it('shows "Not sent" with "Try again" when it failed', async () => {
    const onRetry = vi.fn()
    render(<MessageUser text="x" failed onRetry={onRetry} />)
    expect(screen.getByText('Not sent')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows no failure UI normally', () => {
    render(<MessageUser text="x" onRetry={() => {}} />)
    expect(screen.queryByText('Not sent')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
