import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Gallery } from '@ui/gallery'
import gallery from './gallery'

describe('style gallery', () => {
  it('has the title "Style" and uniquely named sections', () => {
    expect(gallery.title).toBe('Style')
    const names = gallery.sections.map((section) => section.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names.length).toBeGreaterThanOrEqual(7)
  })

  it('renders every section with its heading', () => {
    render(<Gallery groups={[gallery]} />)
    for (const section of gallery.sections) {
      expect(screen.getByRole('heading', { level: 3, name: section.name })).toBeInTheDocument()
    }
  })

  it('shows every file status and the building skeletons', () => {
    const { container } = render(<Gallery groups={[gallery]} />)
    for (const label of ['Waiting', 'Reading…', 'Learned', 'Couldn’t read']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(container.querySelectorAll('[aria-busy="true"] .lc__skeleton').length).toBeGreaterThan(0)
  })
})
