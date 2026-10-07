import { describe, expect, it } from 'vitest'
import type { Slide } from '@shared/deck/types'
import { slideLabel } from './slideLabel'

const titled: Slide = {
  id: 's1',
  kind: 'content',
  elements: [
    {
      id: 't',
      type: 'text',
      role: 'title',
      x: 0,
      y: 0,
      w: 100,
      h: 50,
      paragraphs: [{ runs: [{ text: 'What do ' }, { text: 'plants need?' }] }]
    }
  ]
}

describe('slideLabel', () => {
  it('joins the number and the title text', () => {
    expect(slideLabel(titled, 3)).toBe('Slide 3: What do plants need?')
  })

  it('is just the number when there is no title', () => {
    expect(slideLabel({ id: 's2', kind: 'custom', elements: [] }, 5)).toBe('Slide 5')
  })
})
