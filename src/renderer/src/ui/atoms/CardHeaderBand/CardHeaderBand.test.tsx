import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardHeaderBand } from './CardHeaderBand'

describe('CardHeaderBand', () => {
  it('shows title, subtitle, leading and trailing content', () => {
    render(
      <CardHeaderBand
        title="Your planning buddy"
        subtitle="Knows your Science style"
        leading={<span data-testid="lead" />}
        trailing={<span>Updates as each file is read</span>}
      />
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'Your planning buddy' })
    ).toBeInTheDocument()
    expect(screen.getByText('Knows your Science style')).toBeInTheDocument()
    expect(screen.getByTestId('lead')).toBeInTheDocument()
    expect(screen.getByText('Updates as each file is read')).toBeInTheDocument()
  })

  it('defaults to the yellow tone and accepts a plugin tone', () => {
    const { container, rerender } = render(<CardHeaderBand title="a" />)
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'yellow')
    rerender(<CardHeaderBand title="a" tone="peach" />)
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'peach')
  })

  it('uses the requested heading level and padding', () => {
    const { container } = render(<CardHeaderBand title="Quiz" level={3} padding="14px 16px" />)
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
    expect(container.firstElementChild).toHaveStyle('--band-pad: 14px 16px')
  })

  it('omits the optional parts when not given', () => {
    const { container } = render(<CardHeaderBand title="Only a title" />)
    expect(container.querySelector('.ui-band__subtitle')).toBeNull()
    expect(container.querySelector('.ui-band__trailing')).toBeNull()
  })
})
