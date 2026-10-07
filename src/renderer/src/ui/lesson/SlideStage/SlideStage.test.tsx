import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { overflowSlide, sampleDeck, sampleStyle } from '../../slide/galleryData'
import { SlideStage, type StageBox } from './SlideStage'

const slide = sampleDeck.slides[0]

describe('SlideStage', () => {
  it('draws the slide with the teacher’s style and its accessible name', () => {
    render(<SlideStage slide={slide} styleProfile={sampleStyle} label="Slide 1: Title" />)
    expect(screen.getByRole('group', { name: 'Slide 1: Title' })).toHaveAttribute(
      'data-slide-id',
      slide.id
    )
  })

  it('is a plain, non-focusable frame', () => {
    const { container } = render(<SlideStage slide={slide} styleProfile={null} />)
    const stage = container.firstElementChild!
    expect(stage).toHaveAttribute('data-state', 'ready')
    expect(stage).not.toHaveAttribute('tabindex')
  })

  describe('annotation layer', () => {
    it('shows overlay children above the slide', () => {
      const { container } = render(
        <SlideStage slide={slide} styleProfile={null}>
          <svg data-testid="regions" viewBox="0 0 1920 1080" />
        </SlideStage>
      )
      const overlay = container.querySelector('.slide-stage__overlay')!
      expect(overlay).toContainElement(screen.getByTestId('regions'))
      expect(overlay.previousElementSibling).toHaveClass('slide-view')
    })

    it('has no overlay layer without children', () => {
      const { container } = render(<SlideStage slide={slide} styleProfile={null} />)
      expect(container.querySelector('.slide-stage__overlay')).not.toBeInTheDocument()
    })

    it('hands a render function the stage size and scale', () => {
      const render_ = vi.fn((_box: StageBox) => <span data-testid="label" />)
      render(
        <SlideStage slide={slide} styleProfile={null}>
          {render_}
        </SlideStage>
      )
      expect(screen.getByTestId('label')).toBeInTheDocument()
      const box = render_.mock.calls[0][0]
      expect(box.width).toBeCloseTo(box.scale * 1920)
      expect(box.height).toBeCloseTo(box.scale * 1080)
    })
  })

  describe('cursor', () => {
    it.each([['default'], ['crosshair'], ['text']] as const)('follows the %s tool', (cursor) => {
      const { container } = render(<SlideStage slide={slide} styleProfile={null} cursor={cursor} />)
      expect(container.firstElementChild).toHaveAttribute('data-cursor', cursor)
    })
  })

  describe('loading', () => {
    it('shows a pulsing skeleton, announced, instead of the slide and overlay', () => {
      const { container } = render(
        <SlideStage slide={slide} styleProfile={null} loading>
          <svg data-testid="regions" />
        </SlideStage>
      )
      expect(screen.getByRole('status', { name: 'Building your slides' })).toBeInTheDocument()
      expect(container.querySelector('.slide-view')).not.toBeInTheDocument()
      expect(screen.queryByTestId('regions')).not.toBeInTheDocument()
      expect(container.firstElementChild).toHaveAttribute('data-state', 'loading')
    })

    it('shows the skeleton while there is no slide yet, with custom wording', () => {
      render(<SlideStage slide={null} styleProfile={null} loading loadingLabel="Making slide 1" />)
      expect(screen.getByRole('status', { name: 'Making slide 1' })).toBeInTheDocument()
    })

    it('ignores the empty state while loading', () => {
      render(<SlideStage slide={null} styleProfile={null} loading empty={<p>Nothing here</p>} />)
      expect(screen.queryByText('Nothing here')).not.toBeInTheDocument()
    })
  })

  describe('empty', () => {
    it('shows the given empty state in place of the frame', () => {
      const { container } = render(
        <SlideStage slide={null} styleProfile={null} empty={<p>Your slides will appear here</p>} />
      )
      expect(screen.getByText('Your slides will appear here')).toBeInTheDocument()
      expect(container.firstElementChild).toHaveAttribute('data-state', 'empty')
      expect(container.firstElementChild).toHaveAttribute('data-bare')
    })

    it('keeps an empty frame when no empty state is given', () => {
      const { container } = render(<SlideStage slide={null} styleProfile={null} />)
      expect(container.firstElementChild).toHaveAttribute('data-state', 'empty')
      expect(container.firstElementChild).not.toHaveAttribute('data-bare')
      expect(container.querySelector('.slide-view')).not.toBeInTheDocument()
    })

    it('ignores the empty state once there is a slide', () => {
      render(<SlideStage slide={slide} styleProfile={null} empty={<p>Nothing here</p>} />)
      expect(screen.queryByText('Nothing here')).not.toBeInTheDocument()
    })

    it('switches from empty to a slide on the same stage', () => {
      const { rerender, container } = render(<SlideStage slide={null} styleProfile={null} />)
      rerender(<SlideStage slide={slide} styleProfile={null} />)
      expect(container.querySelector('.slide-view')).toBeInTheDocument()
    })
  })

  it('shows the "doesn’t fit" badge only when asked to', () => {
    const never = () => false
    const { rerender } = render(
      <SlideStage slide={overflowSlide} styleProfile={sampleStyle} measurer={never} />
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    rerender(
      <SlideStage slide={overflowSlide} styleProfile={sampleStyle} measurer={never} showFitBadges />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Doesn’t fit')
  })
})
