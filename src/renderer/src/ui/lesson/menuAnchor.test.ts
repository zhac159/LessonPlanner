import { describe, expect, it } from 'vitest'
import { anchorForContextMenu } from './menuAnchor'

const element = { getBoundingClientRect: () => ({ left: 40, bottom: 100 }) }

describe('anchorForContextMenu', () => {
  it('opens at the pointer for a mouse right-click', () => {
    expect(anchorForContextMenu({ clientX: 210, clientY: 330 }, element)).toEqual({
      x: 210,
      y: 330
    })
  })

  it('opens under the element when the keyboard raised the event', () => {
    expect(anchorForContextMenu({ clientX: 0, clientY: 0 }, element)).toEqual({ x: 40, y: 104 })
  })
})
