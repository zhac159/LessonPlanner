import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NumberDisc } from './NumberDisc'

describe('NumberDisc', () => {
  it('shows its numeral with the requested tone and size', () => {
    render(
      <NumberDisc tone="orange" size={36}>
        2
      </NumberDisc>
    )
    const disc = screen.getByText('2')
    expect(disc).toHaveAttribute('data-tone', 'orange')
    expect(disc).toHaveAttribute('data-size', '36')
  })

  it('swaps the numeral for a check mark when done', () => {
    const { container } = render(<NumberDisc done>3</NumberDisc>)
    expect(screen.queryByText('3')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'mint')
  })
})
