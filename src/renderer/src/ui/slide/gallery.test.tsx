import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TextView } from './elements/TextView'
import gallery from './gallery'
import { allElementsSlide, sampleDeck } from './galleryData'

describe('slide gallery', () => {
  it('has a title and uniquely named sections', () => {
    expect(gallery.title).toBe('Slides')
    const names = gallery.sections.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names.length).toBeGreaterThanOrEqual(4)
  })

  it.each(gallery.sections.map((s) => [s.name, s] as const))(
    'renders the "%s" section',
    (_name, section) => {
      const { container } = render(<>{section.render()}</>)
      expect(container.querySelectorAll('.slide-view').length).toBeGreaterThan(0)
    }
  )

  it('shows every fixture slide of the photosynthesis deck', () => {
    render(<>{gallery.sections[0].render()}</>)
    for (const slide of sampleDeck.slides) {
      expect(screen.getByRole('group', { name: `Slide ${slide.id}` })).toBeInTheDocument()
    }
  })

  it('covers every element type', () => {
    const types = new Set(
      [...allElementsSlide.elements, ...sampleDeck.slides.flatMap((s) => s.elements)].map(
        (e) => e.type
      )
    )
    expect([...types].sort()).toEqual([
      'callout',
      'chips',
      'diagram',
      'image',
      'shape',
      'table',
      'text'
    ])
  })

  it('sample SVG survives the sanitiser (the diagram is drawn, not "unavailable")', () => {
    const { container } = render(<>{gallery.sections[1].render()}</>)
    expect(container.querySelector('.slide-diagram svg')).not.toBeNull()
    expect(container.textContent).not.toContain('Diagram unavailable')
  })
})

describe('slide element views', () => {
  it('refuse to render outside a SlideView', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const text = allElementsSlide.elements.find((e) => e.type === 'text')!
    expect(() => render(<TextView element={text as never} />)).toThrow(/inside <SlideView>/)
    spy.mockRestore()
  })
})
