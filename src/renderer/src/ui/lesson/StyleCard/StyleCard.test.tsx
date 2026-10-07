import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StyleCard, type StyleCardProps } from './StyleCard'

const base: StyleCardProps = {
  name: 'Science KS3',
  titleFont: 'Lexend',
  deckCount: 24,
  swatches: ['#0E7C7B', '#12263A', '#FFE36E', '#E3F2F1'],
  onOpen: () => {}
}

describe('StyleCard', () => {
  it('is one button named after the style and described by its meta line', () => {
    render(<StyleCard {...base} />)
    const card = screen.getByRole('button', { name: 'Science KS3' })
    expect(card).toHaveAccessibleDescription('Lexend · learned from 24 decks')
  })

  it('uses the singular for one deck', () => {
    render(<StyleCard {...base} deckCount={1} />)
    expect(screen.getByText('Lexend · learned from 1 deck')).toBeInTheDocument()
  })

  it('leaves out what it does not know', () => {
    const { rerender } = render(<StyleCard {...base} deckCount={0} />)
    expect(screen.getByText('Lexend')).toBeInTheDocument()
    rerender(<StyleCard {...base} titleFont={undefined} deckCount={3} />)
    expect(screen.getByText('learned from 3 decks')).toBeInTheDocument()
    rerender(<StyleCard {...base} titleFont={undefined} deckCount={0} />)
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-describedby')
  })

  it('shows the swatches as decoration', () => {
    const { container } = render(<StyleCard {...base} />)
    const swatches = container.querySelector('.ui-swatches')!
    expect(swatches).toHaveAttribute('aria-hidden', 'true')
    expect(swatches.querySelectorAll('.ui-swatches__dot')).toHaveLength(4)
  })

  it('opens on click, Enter and Space', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<StyleCard {...base} onOpen={onOpen} />)
    await user.click(screen.getByRole('button'))
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onOpen).toHaveBeenCalledTimes(3)
  })

  it('marks the default style with an inverse "Default" pill', () => {
    const { container } = render(<StyleCard {...base} isDefault />)
    expect(screen.getByText('Default').parentElement).toHaveAttribute('data-tone', 'inverse')
    expect(container.querySelector('article')).toHaveAttribute('data-default')
  })

  it('has no pill for an ordinary style', () => {
    const { container } = render(<StyleCard {...base} />)
    expect(container.querySelector('.ui-pill')).not.toBeInTheDocument()
    expect(container.querySelector('article')).not.toHaveAttribute('data-default')
  })

  it('shows a working "Learning…" pill in place of "Default" while learning', () => {
    render(<StyleCard {...base} isDefault status="learning" />)
    expect(screen.getByText('Learning…').parentElement).toHaveAttribute('data-tone', 'working')
    expect(screen.queryByText('Default')).not.toBeInTheDocument()
  })

  describe('actions', () => {
    it('has no extra buttons by default', () => {
      render(<StyleCard {...base} />)
      expect(screen.getAllByRole('button')).toHaveLength(1)
    })

    it('Edit and Set as default call their handlers without opening the card', async () => {
      const user = userEvent.setup()
      const onOpen = vi.fn()
      const onEdit = vi.fn()
      const onSetDefault = vi.fn()
      render(<StyleCard {...base} onOpen={onOpen} onEdit={onEdit} onSetDefault={onSetDefault} />)
      await user.click(screen.getByRole('button', { name: 'Edit Science KS3' }))
      await user.click(screen.getByRole('button', { name: 'Set as default, Science KS3' }))
      expect(onEdit).toHaveBeenCalledTimes(1)
      expect(onSetDefault).toHaveBeenCalledTimes(1)
      expect(onOpen).not.toHaveBeenCalled()
    })

    it('does not offer Set as default on the default style', () => {
      render(<StyleCard {...base} isDefault onSetDefault={() => {}} onEdit={() => {}} />)
      expect(screen.queryByRole('button', { name: /Set as default/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Edit Science KS3' })).toBeInTheDocument()
    })
  })
})
