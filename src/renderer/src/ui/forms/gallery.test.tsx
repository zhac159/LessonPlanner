import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import gallery from './gallery'

describe('forms gallery', () => {
  it('has a title and uniquely named sections', () => {
    expect(gallery.title).toBe('Forms')
    const names = gallery.sections.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names.length).toBeGreaterThanOrEqual(7)
  })

  it.each(gallery.sections.map((s) => [s.name, s] as const))(
    'renders the %s section without errors and with labelled controls',
    (_name, section) => {
      const { container } = render(<>{section.render()}</>)
      expect(container.children.length).toBeGreaterThan(0)
      for (const control of container.querySelectorAll('input, select, textarea')) {
        const el = control as HTMLInputElement
        const labelled =
          el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
        expect(labelled, `${el.outerHTML} needs an accessible name`).toBeTruthy()
      }
      for (const button of container.querySelectorAll('button')) {
        const named = button.textContent?.trim() || button.getAttribute('aria-label')
        expect(named, `${button.outerHTML} needs an accessible name`).toBeTruthy()
      }
    }
  )
})
