import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('exposes progressbar semantics with value text', () => {
    render(
      <ProgressBar
        value={6}
        max={8}
        label="6 of 8 learned"
        estimate="About a minute left"
        valueText="6 of 8 files learned"
      />
    )
    const bar = screen.getByRole('progressbar', { name: '6 of 8 learned' })
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '8')
    expect(bar).toHaveAttribute('aria-valuenow', '6')
    expect(bar).toHaveAttribute('aria-valuetext', '6 of 8 files learned')
    expect(screen.getByText('About a minute left')).toBeInTheDocument()
    expect(bar.firstElementChild).toHaveStyle({ width: '75%' })
  })

  it('clamps out-of-range values and tolerates a zero total', () => {
    const { rerender } = render(<ProgressBar value={12} max={8} label="done" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '8')
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '100%' })
    rerender(<ProgressBar value={-3} max={8} label="done" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    rerender(<ProgressBar value={0} max={0} label="done" />)
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0%' })
  })

  it('drops the ink edge at 0% and 100%', () => {
    const { rerender } = render(<ProgressBar value={0} max={4} label="x" />)
    const fill = (): Element => screen.getByRole('progressbar').firstElementChild!
    expect(fill()).toHaveAttribute('data-edge', 'none')
    rerender(<ProgressBar value={2} max={4} label="x" />)
    expect(fill()).toHaveAttribute('data-edge', 'rule')
    rerender(<ProgressBar value={4} max={4} label="x" />)
    expect(fill()).toHaveAttribute('data-edge', 'none')
  })
})
