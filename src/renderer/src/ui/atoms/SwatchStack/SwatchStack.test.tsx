import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SwatchDot, SwatchStack } from './SwatchStack'

describe('SwatchStack', () => {
  it('shows one circle per colour and is hidden from assistive tech', () => {
    const { container } = render(<SwatchStack colors={['#0f766e', '#1b1530', '#ffe36e']} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    const dots = container.querySelectorAll('.ui-swatches__dot')
    expect(dots).toHaveLength(3)
    expect(dots[0]).toHaveStyle({ background: '#0f766e' })
  })

  it('caps the circles at four and counts the rest', () => {
    const { container } = render(
      <SwatchStack colors={['#111', '#222', '#333', '#444', '#555', '#666']} />
    )
    expect(container.querySelectorAll('.ui-swatches__dot')).toHaveLength(4)
    expect(container).toHaveTextContent('+2')
  })

  it('shows no "+N" when everything fits, and honours a custom max', () => {
    const { container } = render(<SwatchStack colors={['#111', '#222', '#333']} max={2} />)
    expect(container.querySelectorAll('.ui-swatches__dot')).toHaveLength(2)
    expect(container).toHaveTextContent('+1')
    const fits = render(<SwatchStack colors={['#111']} />)
    expect(fits.container).not.toHaveTextContent('+')
  })

  it('renders nothing visible for an empty palette', () => {
    const { container } = render(<SwatchStack colors={[]} />)
    expect(container.querySelectorAll('.ui-swatches__dot')).toHaveLength(0)
  })
})

describe('SwatchDot', () => {
  it('is a decorative dot filled with the colour', () => {
    const { container } = render(<SwatchDot color="#0f766e" />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.firstElementChild).toHaveStyle({ background: '#0f766e' })
  })
})
