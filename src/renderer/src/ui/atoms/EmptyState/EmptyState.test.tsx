import { render, screen } from '@testing-library/react'
import { Monitor } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('names itself after its title and shows body and actions', () => {
    render(
      <EmptyState
        icon={<Monitor />}
        title="Your slides will appear here"
        actions={<button type="button">Blank slide</button>}
      >
        Tell the planning buddy what you teach.
      </EmptyState>
    )
    expect(screen.getByRole('region', { name: 'Your slides will appear here' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Your slides will appear here' })
    ).toBeInTheDocument()
    expect(screen.getByText('Tell the planning buddy what you teach.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Blank slide' })).toBeInTheDocument()
  })

  it('omits body and actions when not given', () => {
    const { container } = render(<EmptyState icon={<Monitor />} title="Nothing yet" />)
    expect(container.querySelector('.ui-empty__body')).toBeNull()
    expect(container.querySelector('.ui-empty__actions')).toBeNull()
  })

  it('uses a bigger tile for the stage variant than the list variant', () => {
    const { container, rerender } = render(<EmptyState icon={<Monitor />} title="a" />)
    expect(container.querySelector('.ui-icon-tile')).toHaveAttribute('data-size', '76')
    rerender(<EmptyState icon={<Monitor />} title="a" variant="list" />)
    expect(container.querySelector('.ui-icon-tile')).toHaveAttribute('data-size', '52')
    expect(container.firstElementChild).toHaveAttribute('data-variant', 'list')
  })
})
