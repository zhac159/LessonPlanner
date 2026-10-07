import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Slide } from '@shared/deck/types'
import { SlideStage } from './SlideStage'

const slide: Slide = {
  id: 's3',
  kind: 'content',
  elements: [
    {
      id: 'spot1',
      type: 'image',
      x: 1000,
      y: 200,
      w: 600,
      h: 500,
      fit: 'cover',
      alt: 'A leaf',
      placeholder: { description: 'A leaf in sunlight, close up' }
    }
  ]
}

describe('SlideStage: picture spots', () => {
  it('draws the dashed "Picture spot" box as a button that fills it', async () => {
    const onFillSpot = vi.fn()
    render(<SlideStage slide={slide} styleProfile={null} spots="editor" onFillSpot={onFillSpot} />)
    expect(screen.getByText('Picture spot')).toBeInTheDocument()
    expect(screen.getByText('Fill this spot')).toBeInTheDocument()
    await userEvent
      .setup()
      .click(
        screen.getByRole('button', { name: 'Fill picture spot: A leaf in sunlight, close up' })
      )
    expect(onFillSpot).toHaveBeenCalledWith('spot1')
  })

  it('shows nothing for a spot by default', () => {
    render(<SlideStage slide={slide} styleProfile={null} />)
    expect(screen.queryByText('Picture spot')).not.toBeInTheDocument()
  })
})
