import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import gallery from './gallery'

describe('lesson gallery', () => {
  it('has a title and uniquely named sections', () => {
    expect(gallery.title).toBe('Lesson')
    const names = gallery.sections.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names.length).toBeGreaterThanOrEqual(8)
  })

  it.each(gallery.sections.map((s) => [s.name, s] as const))(
    'renders the %s section with every button named',
    (_name, section) => {
      const { container } = render(<>{section.render()}</>)
      expect(container.children.length).toBeGreaterThan(0)
      for (const button of container.querySelectorAll('button')) {
        const named = button.textContent?.trim() || button.getAttribute('aria-label')
        expect(named || button.getAttribute('aria-labelledby'), button.outerHTML).toBeTruthy()
      }
    }
  )
})
