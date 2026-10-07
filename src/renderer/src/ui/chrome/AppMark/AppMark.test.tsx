import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppMark } from './AppMark'

describe('AppMark', () => {
  it('is decorative and 22px by default', () => {
    const { container } = render(<AppMark />)
    const mark = container.firstElementChild as HTMLElement
    expect(mark).toHaveAttribute('aria-hidden', 'true')
    expect(mark).toHaveStyle({ width: '22px', height: '22px' })
    expect(mark.querySelector('svg')).toBeInTheDocument()
  })

  it('scales with the requested size', () => {
    const { container } = render(<AppMark size={40} />)
    expect(container.firstElementChild).toHaveStyle({ width: '40px' })
  })
})
