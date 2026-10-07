import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressDots } from './ProgressDots'

describe('ProgressDots', () => {
  it('renders three dots and is hidden from assistive tech', () => {
    const { container } = render(<ProgressDots />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root.querySelectorAll('i')).toHaveLength(3)
  })

  it('exposes its size as a data attribute', () => {
    const { container } = render(<ProgressDots size="sm" className="extra" />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute('data-size', 'sm')
    expect(root).toHaveClass('extra')
  })
})
