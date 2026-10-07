import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SetupSteps } from './SetupSteps'

const ITEMS = [
  { id: 'a', title: 'Tell me about you' },
  { id: 'b', title: 'Connect Claude' },
  { id: 'c', title: 'Teach me your style', optional: true }
]

describe('SetupSteps', () => {
  it('renders a labelled ordered list', () => {
    render(<SetupSteps items={ITEMS} />)
    expect(screen.getByRole('list', { name: 'Setup steps' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('marks done, current and upcoming steps in the checklist', () => {
    render(<SetupSteps items={ITEMS} current={1} />)
    const [a, b, c] = screen.getAllByRole('listitem')
    expect(a).toHaveAttribute('data-state', 'done')
    expect(a).not.toHaveAttribute('aria-current')
    expect(b).toHaveAttribute('data-state', 'current')
    expect(b).toHaveAttribute('aria-current', 'step')
    expect(c).toHaveAttribute('data-state', 'upcoming')
  })

  it('shows "(optional)" after the title', () => {
    render(<SetupSteps items={ITEMS} />)
    expect(screen.getByText('(optional)')).toBeInTheDocument()
  })

  it('numbers items in the hero variant without state', () => {
    render(<SetupSteps items={ITEMS} variant="hero" aria-label="How it works" />)
    expect(screen.getByRole('list', { name: 'How it works' })).toHaveAttribute(
      'data-variant',
      'hero'
    )
    expect(screen.getByText('2')).toHaveAttribute('data-size', '36')
    expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('data-state', 'plain')
  })

  it('shows details in the cards variant and cycles disc tones', () => {
    render(
      <SetupSteps
        variant="cards"
        items={[
          { id: '1', title: 'Sign in', detail: 'Go to the console' },
          { id: '2', title: 'Create a key' },
          { id: '3', title: 'Paste it' },
          { id: '4', title: 'Test it' }
        ]}
      />
    )
    expect(screen.getByText('Go to the console')).toBeInTheDocument()
    expect(screen.getByText('1')).toHaveAttribute('data-tone', 'peach')
    expect(screen.getByText('4')).toHaveAttribute('data-tone', 'peach')
  })
})
