import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LICENCES } from '@shared/assets/credits'
import { OnlineResultCard } from './OnlineResultCard'

const base = {
  title: 'Volcano cross-section',
  providerLabel: 'Wikimedia Commons',
  licence: LICENCES['cc-by-sa']
}

describe('OnlineResultCard', () => {
  it('shows the title, the source and the licence pill', () => {
    render(<OnlineResultCard {...base} />)
    expect(screen.getByText('Volcano cross-section')).toBeInTheDocument()
    expect(screen.getByText('Wikimedia Commons')).toBeInTheDocument()
    expect(screen.getByText('CC BY-SA')).toBeInTheDocument()
  })

  it('names its button with the title, the source and the licence', () => {
    render(<OnlineResultCard {...base} />)
    expect(
      screen.getByRole('button', {
        name: 'Volcano cross-section, Wikimedia Commons, CC BY-SA'
      })
    ).toBeInTheDocument()
  })

  it('selects on click and Enter and shows aria-pressed', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(<OnlineResultCard {...base} onSelect={onSelect} />)
    const card = screen.getByRole('button')
    expect(card).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(card)
    card.focus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(2)
    rerender(<OnlineResultCard {...base} selected onSelect={onSelect} />)
    expect(card).toHaveAttribute('aria-pressed', 'true')
  })

  it('has a checkbox only when checkable, named after the title, and reports ticks', async () => {
    const onCheckedChange = vi.fn()
    const { rerender } = render(<OnlineResultCard {...base} />)
    expect(screen.queryByRole('checkbox')).toBeNull()
    rerender(<OnlineResultCard {...base} checkable onCheckedChange={onCheckedChange} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Volcano cross-section' }))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('shows a ticked card with the selected look', () => {
    const { container } = render(<OnlineResultCard {...base} checkable checked />)
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(container.firstElementChild).toHaveAttribute('data-selected', 'true')
  })

  it('compact cards leave out the source line', () => {
    const { container } = render(<OnlineResultCard {...base} compact />)
    expect(screen.queryByText('Wikimedia Commons')).toBeNull()
    expect(container.firstElementChild).toHaveAttribute('data-compact', 'true')
    expect(screen.getByText('CC BY-SA')).toBeInTheDocument()
  })

  it('shows amber licences as "Check licence" with the real one on hover', () => {
    render(<OnlineResultCard {...base} licence={LICENCES['cc-by-nc']} />)
    expect(screen.getByText('Check licence')).toHaveAttribute('title', 'CC BY-NC')
  })

  it('draws the picture with empty alt text', () => {
    const { container } = render(<OnlineResultCard {...base} thumbSrc="data:image/png;base64,AA" />)
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })
})
