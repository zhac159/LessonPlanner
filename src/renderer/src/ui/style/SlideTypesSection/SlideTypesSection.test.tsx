import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { sampleData } from '../galleryData'
import { SlideTypesSection, TAG_TINTS } from './SlideTypesSection'

const names = sampleData.slideTypes ?? []

describe('SlideTypesSection', () => {
  it('shows a tag per slide type', () => {
    render(<SlideTypesSection names={names} />)
    expect(screen.getByRole('region', { name: 'Slide types you use' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(names.length)
    expect(screen.getByText(names[0])).toBeInTheDocument()
  })

  it('cycles the tag tints in order and wraps round', () => {
    const many = Array.from({ length: TAG_TINTS.length + 1 }, (_, i) => `Type ${i}`)
    render(<SlideTypesSection names={many} />)
    many.forEach((name, i) => {
      const pill = screen.getByText(name).closest('.ui-pill') as HTMLElement
      expect(pill.style.getPropertyValue('--pill-bg')).toBe(TAG_TINTS[i % TAG_TINTS.length])
    })
  })

  it('shows skeleton tags while building', () => {
    const { container } = render(<SlideTypesSection names={null} />)
    expect(container.querySelectorAll('.lc__skeleton[data-layout="tags"]')).toHaveLength(3)
  })
})
