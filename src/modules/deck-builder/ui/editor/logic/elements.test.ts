import { describe, expect, it } from 'vitest'
import { fixtureDeck, makeSlide, makeText } from '@shared/deck/testing'
import type { Element } from '@shared/deck/types'
import {
  DRAG_THRESHOLD_PX,
  dragOffset,
  elementLabel,
  isDrag,
  nudgeDelta,
  selectableElements
} from './elements'

describe('selectableElements', () => {
  it('leaves out locked decorations', () => {
    const slide = fixtureDeck().slides[0]
    const ids = selectableElements(slide).map((e) => e.id)
    expect(ids).not.toContain('s1-band')
    expect(ids).toEqual(['s1-kicker', 's1-title'])
  })

  it('orders by z then by document order (back to front)', () => {
    const slide = makeSlide('s', {
      elements: [
        makeText('top', 'a', { z: 5 }),
        makeText('first', 'b'),
        makeText('second', 'c'),
        makeText('locked', 'd', { locked: true })
      ]
    })
    expect(selectableElements(slide).map((e) => e.id)).toEqual(['first', 'second', 'top'])
  })
})

describe('elementLabel', () => {
  it('names the kind and the start of the text', () => {
    expect(elementLabel(makeText('t', 'What do plants need?'))).toBe(
      'Text box: What do plants need?'
    )
  })

  it('shortens long text with an ellipsis', () => {
    const label = elementLabel(makeText('t', 'x'.repeat(100)))
    expect(label.startsWith('Text box: ')).toBe(true)
    expect(label.endsWith('…')).toBe(true)
    expect(label.length).toBeLessThan(60)
  })

  it('does not repeat the name when the text already starts with it', () => {
    expect(elementLabel(makeText('t', 'Photo: leaf in sunlight', { name: 'photo' }))).toBe(
      'Photo: leaf in sunlight'
    )
  })

  it('uses the element name, capitalised, when there is one', () => {
    expect(elementLabel(makeText('t', '', { name: 'photo' }))).toBe('Photo')
  })

  it('has a name for every kind without text', () => {
    const image = {
      id: 'i',
      type: 'image',
      alt: 'a plant',
      x: 0,
      y: 0,
      w: 1,
      h: 1
    } as unknown as Element
    expect(elementLabel(image)).toBe('Picture: a plant')
  })
})

describe('nudgeDelta', () => {
  it('moves 10 units, or 50 with Shift', () => {
    expect(nudgeDelta('ArrowLeft', false)).toEqual({ dx: -10, dy: 0 })
    expect(nudgeDelta('ArrowDown', false)).toEqual({ dx: 0, dy: 10 })
    expect(nudgeDelta('ArrowRight', true)).toEqual({ dx: 50, dy: 0 })
    expect(nudgeDelta('ArrowUp', true)).toEqual({ dx: 0, dy: -50 })
  })

  it('ignores other keys', () => {
    expect(nudgeDelta('a', false)).toBeNull()
  })
})

describe('drag helpers', () => {
  it('turns pixels into slide units at the stage scale', () => {
    expect(dragOffset(50, -25, 0.5)).toEqual({ x: 100, y: -50 })
    expect(dragOffset(10, 10, 0)).toEqual({ x: 0, y: 0 })
  })

  it('tells a click from a drag by distance', () => {
    expect(isDrag(1, 1)).toBe(false)
    expect(isDrag(DRAG_THRESHOLD_PX, 0)).toBe(true)
    expect(isDrag(3, 3)).toBe(true)
  })
})
