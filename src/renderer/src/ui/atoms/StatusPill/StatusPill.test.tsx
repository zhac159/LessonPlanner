import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusPill } from './StatusPill'

describe('StatusPill', () => {
  it('shows its word with tone and size attributes', () => {
    render(
      <StatusPill tone="done" size="md">
        Learned
      </StatusPill>
    )
    const pill = screen.getByText('Learned').parentElement!
    expect(pill).toHaveAttribute('data-tone', 'done')
    expect(pill).toHaveAttribute('data-size', 'md')
  })

  it('is static by default and only a live region when asked', () => {
    const { rerender } = render(<StatusPill>Waiting</StatusPill>)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    rerender(
      <StatusPill live check tone="done">
        Connected
      </StatusPill>
    )
    expect(screen.getByRole('status')).toHaveTextContent('Connected')
  })

  it('adds progress dots for the working tone', () => {
    const { container } = render(<StatusPill tone="working">Reading…</StatusPill>)
    expect(container.querySelector('.ui-dots')).toBeInTheDocument()
  })

  it('adds an alert icon for the error tone', () => {
    const { container } = render(<StatusPill tone="error">Couldn’t read this file</StatusPill>)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('fills tag pills with the given colour', () => {
    render(
      <StatusPill tone="tag" color="var(--year-8)">
        Year 8
      </StatusPill>
    )
    expect(screen.getByText('Year 8').parentElement).toHaveStyle('--pill-bg: var(--year-8)')
  })
})
