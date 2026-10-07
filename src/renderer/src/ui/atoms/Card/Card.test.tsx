import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card } from './Card'

describe('Card', () => {
  it('renders its children in a page card with a large shadow by default', () => {
    render(<Card data-testid="c">Hello</Card>)
    const card = screen.getByTestId('c')
    expect(card).toHaveTextContent('Hello')
    expect(card).toHaveAttribute('data-variant', 'page')
    expect(card).toHaveAttribute('data-shadow', 'lg')
    expect(card).toHaveAttribute('data-tone', 'white')
  })

  it.each([
    ['panel', 'lg'],
    ['raised', 'md'],
    ['selected', 'sm'],
    ['inner', 'none']
  ] as const)('%s uses the %s shadow', (variant, shadow) => {
    render(
      <Card variant={variant} data-testid="c">
        x
      </Card>
    )
    expect(screen.getByTestId('c')).toHaveAttribute('data-shadow', shadow)
  })

  it('lets the shadow be overridden', () => {
    render(
      <Card variant="inner" shadow="sm" data-testid="c">
        x
      </Card>
    )
    expect(screen.getByTestId('c')).toHaveAttribute('data-shadow', 'sm')
  })

  it('renders as the requested element and passes aria attributes through', () => {
    render(
      <Card as="section" aria-label="Your styles">
        x
      </Card>
    )
    expect(screen.getByRole('region', { name: 'Your styles' }).tagName).toBe('SECTION')
  })

  it('sets padding and clips flush cards', () => {
    const { rerender } = render(
      <Card padding={28} data-testid="c">
        x
      </Card>
    )
    expect(screen.getByTestId('c')).toHaveStyle('--card-pad: 28px')
    expect(screen.getByTestId('c')).not.toHaveAttribute('data-flush')
    rerender(
      <Card padding={0} data-testid="c">
        x
      </Card>
    )
    expect(screen.getByTestId('c')).toHaveAttribute('data-flush', 'true')
  })

  it('supports the accent tone', () => {
    render(
      <Card tone="accent" data-testid="c">
        x
      </Card>
    )
    expect(screen.getByTestId('c')).toHaveAttribute('data-tone', 'accent')
  })
})
