import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { sampleDeck, sampleStyle } from '../../slide/galleryData'
import { LessonCard, type LessonCardProps } from './LessonCard'

const NOW = new Date(2026, 5, 15, 10)
const base: LessonCardProps = {
  title: 'Photosynthesis',
  yearTag: 'Year 8',
  slideCount: 8,
  updatedAt: new Date(2026, 5, 15, 8).toISOString(),
  now: NOW,
  onOpen: () => {}
}

describe('LessonCard', () => {
  it('shows the title, year chip, slide count and relative date', () => {
    render(<LessonCard {...base} />)
    const card = screen.getByRole('button', { name: 'Photosynthesis' })
    expect(card).toHaveAccessibleDescription(/Year 8.*8 slides.*Today/)
    expect(screen.getByText('Year 8').parentElement).toHaveStyle('--pill-bg: var(--year-8)')
    expect(screen.getByText('Today')).toHaveAttribute('datetime', base.updatedAt)
  })

  it('says "1 slide" for a single slide and formats older dates', () => {
    render(
      <LessonCard {...base} slideCount={1} updatedAt={new Date(2026, 5, 12, 9).toISOString()} />
    )
    expect(screen.getByText('1 slide')).toBeInTheDocument()
    expect(screen.getByText('3 days ago')).toBeInTheDocument()
  })

  it('omits the year chip when the lesson has no year group', () => {
    render(<LessonCard {...base} yearTag={null} />)
    expect(document.querySelector('.ui-pill')).not.toBeInTheDocument()
  })

  it('opens the lesson on click, Enter and Space', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<LessonCard {...base} onOpen={onOpen} />)
    const card = screen.getByRole('button', { name: 'Photosynthesis' })
    await user.click(card)
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onOpen).toHaveBeenCalledTimes(3)
  })

  describe('thumbnail', () => {
    it('draws slide 1 live with the lesson style', () => {
      const { container } = render(
        <LessonCard {...base} slide={sampleDeck.slides[0]} styleProfile={sampleStyle} />
      )
      expect(container.querySelector('.slide-view')).toHaveAttribute(
        'data-slide-id',
        sampleDeck.slides[0].id
      )
    })

    it('hides the picture from assistive technology (the title names the card)', () => {
      const { container } = render(
        <LessonCard {...base} slide={sampleDeck.slides[0]} styleProfile={sampleStyle} />
      )
      expect(container.querySelector('.lesson-card__thumb')).toHaveAttribute('aria-hidden', 'true')
      expect(screen.getByRole('button')).toHaveAccessibleName('Photosynthesis')
    })

    it('falls back to the saved thumbnail picture', () => {
      const { container } = render(
        <LessonCard {...base} thumbDataUrl="data:image/png;base64,AAAA" />
      )
      const image = container.querySelector('img')!
      expect(image).toHaveAttribute('src', 'data:image/png;base64,AAAA')
      expect(image).toHaveAttribute('alt', '')
    })

    it('prefers the live slide over the saved picture', () => {
      const { container } = render(
        <LessonCard
          {...base}
          slide={sampleDeck.slides[0]}
          thumbDataUrl="data:image/png;base64,AAAA"
        />
      )
      expect(container.querySelector('img')).not.toBeInTheDocument()
      expect(container.querySelector('.slide-view')).toBeInTheDocument()
    })

    it('shows an empty tile when there is nothing to draw', () => {
      const { container } = render(<LessonCard {...base} slideCount={0} />)
      expect(container.querySelector('.lesson-card__empty')).toBeInTheDocument()
      expect(container.querySelector('.slide-view')).not.toBeInTheDocument()
    })
  })

  describe('generating', () => {
    it('shows a skeleton thumbnail and a working "Building…" pill instead of the count', () => {
      const { container } = render(<LessonCard {...base} status="generating" slideCount={0} />)
      expect(container.querySelector('[data-variant="generating"]')).toBeInTheDocument()
      expect(screen.getByText('Building…').parentElement).toHaveAttribute('data-tone', 'working')
      expect(screen.queryByText('0 slides')).not.toBeInTheDocument()
    })

    it('still shows slide 1 once it has arrived', () => {
      const { container } = render(
        <LessonCard {...base} status="generating" slide={sampleDeck.slides[0]} />
      )
      expect(container.querySelector('.slide-view')).toBeInTheDocument()
      expect(screen.getByText('Building…')).toBeInTheDocument()
    })
  })

  describe('menu', () => {
    it('has no menu button without onMenu', () => {
      render(<LessonCard {...base} />)
      expect(screen.getAllByRole('button')).toHaveLength(1)
    })

    it('opens the menu below the ⋯ button without opening the lesson', async () => {
      const onMenu = vi.fn()
      const onOpen = vi.fn()
      render(<LessonCard {...base} onMenu={onMenu} onOpen={onOpen} />)
      const trigger = screen.getByRole('button', { name: 'More actions for Photosynthesis' })
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
      await userEvent.setup().click(trigger)
      expect(onMenu).toHaveBeenCalledTimes(1)
      expect(onMenu).toHaveBeenCalledWith({ x: expect.any(Number), y: expect.any(Number) })
      expect(onOpen).not.toHaveBeenCalled()
    })

    it('opens the menu at the pointer on right-click', () => {
      const onMenu = vi.fn()
      render(<LessonCard {...base} onMenu={onMenu} />)
      const prevented = !fireEvent.contextMenu(
        screen.getByRole('button', { name: 'Photosynthesis' }),
        {
          clientX: 120,
          clientY: 90
        }
      )
      expect(prevented).toBe(true)
      expect(onMenu).toHaveBeenCalledWith({ x: 120, y: 90 })
    })

    it('leaves the browser right-click menu alone without onMenu', () => {
      render(<LessonCard {...base} />)
      expect(fireEvent.contextMenu(screen.getByRole('button'))).toBe(true)
    })
  })

  it('marks the selected card', () => {
    const { container } = render(<LessonCard {...base} selected />)
    expect(container.querySelector('article')).toHaveAttribute('data-selected')
  })
})
