import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fixtureDeck, fixtureStyle } from '@shared/deck/testing'
import { TestSlidePreview } from './TestSlidePreview'

const slide = fixtureDeck().slides[0]
const style = fixtureStyle()

describe('TestSlidePreview', () => {
  it('captions the preview and draws the slide with the real renderer', () => {
    const { container } = render(<TestSlidePreview slide={slide} style={style} scale={0.2} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Test slide in this style' })).toBeTruthy()
    expect(container.querySelector('.slide-view')).not.toBeNull()
    expect(screen.getByRole('group', { name: 'Test slide in this style' })).toHaveAttribute(
      'data-slide-id',
      slide.id
    )
    expect(screen.queryByText(/appears after the first file/)).toBeNull()
  })

  it('shows the placeholder text before anything is learned', () => {
    const { container } = render(<TestSlidePreview slide={null} style={null} />)
    expect(screen.getByText('Your test slide appears after the first file.')).toBeInTheDocument()
    expect(container.querySelector('.slide-view')).toBeNull()
  })

  it('shows a skeleton and aria-busy while loading, even when a slide is known', () => {
    const { container } = render(
      <TestSlidePreview slide={slide} style={style} loading scale={0.2} />
    )
    expect(screen.getByTestId('test-slide-skeleton')).toBeInTheDocument()
    expect(container.querySelector('.slide-view')).toBeNull()
    expect(screen.getByRole('region', { name: 'Test slide in this style' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
  })

  it('remounts the slide (to crossfade) when the version changes', () => {
    const { container, rerender } = render(
      <TestSlidePreview slide={slide} style={style} version={1} scale={0.2} />
    )
    const first = container.querySelector('.test-slide__fade')
    rerender(<TestSlidePreview slide={slide} style={style} version={2} scale={0.2} />)
    expect(container.querySelector('.test-slide__fade')).not.toBe(first)
  })
})
