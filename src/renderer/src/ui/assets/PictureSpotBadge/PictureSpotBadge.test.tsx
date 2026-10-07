import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PictureSpotBadge } from './PictureSpotBadge'

describe('PictureSpotBadge', () => {
  it('is a button saying which slide has how many spots', () => {
    render(<PictureSpotBadge slideNumber={3} count={1} onClick={() => {}} />)
    const badge = screen.getByRole('button', { name: 'Slide 3 has 1 picture spot' })
    expect(badge).toHaveTextContent('1')
  })

  it('uses the plural for several spots', () => {
    render(<PictureSpotBadge slideNumber={5} count={2} onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Slide 5 has 2 picture spots' })).toBeInTheDocument()
  })

  it('opens the first spot on click and Enter', async () => {
    const onClick = vi.fn()
    render(<PictureSpotBadge slideNumber={3} count={1} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    screen.getByRole('button').focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('draws nothing when the slide has no empty spots', () => {
    const { container } = render(<PictureSpotBadge slideNumber={3} count={0} onClick={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
