import { describe, expect, it } from 'vitest'
import module from './ui'

describe('deck-builder UI module', () => {
  it('is Lessons: hidden from the sidebar, with the 72px rail, showing the router', () => {
    expect(module).toMatchObject({
      id: 'deck-builder',
      title: 'Lessons',
      nav: 'hidden',
      chrome: 'rail'
    })
    // The screen is loaded on first use (a lazy component), not at startup.
    expect((module.component as unknown as { $$typeof: symbol }).$$typeof).toBe(
      Symbol.for('react.lazy')
    )
    expect(module.icon).toBeDefined()
  })
})
