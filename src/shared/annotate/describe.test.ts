import { describe, expect, it } from 'vitest'
import { fixtureDeck, makeSlide, makeText } from '../deck/testing'
import type { Element } from '../deck/types'
import { describeElement, describeRegion } from './describe'
import type { Point } from './types'

const rect = (x: number, y: number, w: number, h: number): Point[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h]
]

describe('describeElement', () => {
  it('names the id, the type and the content', () => {
    const photo = fixtureDeck().slides[2].elements.find((e) => e.id === 's3-photo') as Element
    expect(describeElement(photo)).toBe('s3-photo (image "Photo: leaf in sunlight")')
  })

  it('cuts long text and flattens line breaks', () => {
    const long = makeText('t1', `${'word '.repeat(40)}\nsecond line`)
    const described = describeElement(long)
    expect(described.startsWith('t1 (text "word word')).toBe(true)
    expect(described).toContain('…"')
    expect(described).not.toContain('\n')
    expect(described.length).toBeLessThan(90)
  })

  it('says which shape and omits an empty label', () => {
    expect(
      describeElement({ id: 'b', type: 'shape', shape: 'ellipse', x: 0, y: 0, w: 10, h: 10 })
    ).toBe('b (shape ellipse)')
    expect(
      describeElement({ id: 'c', type: 'chips', x: 0, y: 0, w: 10, h: 10, items: ['a', 'b'] })
    ).toBe('c (chips "a, b")')
  })
})

describe('describeRegion', () => {
  it('writes the text block of the spec', () => {
    const slide = fixtureDeck().slides[2]
    const text = describeRegion(
      { n: 1, slideId: slide.id, path: rect(1075, 300, 790, 550) },
      slide,
      3
    )
    expect(text).toBe(
      'Region 1 on slide 3 (id s3) targets elements: s3-photo (image "Photo: leaf in sunlight"). ' +
        'Region bbox: x 1075, y 300, w 790, h 550.'
    )
  })

  it('lists several elements in order, separated by commas', () => {
    const slide = makeSlide('s9', {
      elements: [
        makeText('a', 'Alpha', { x: 0, y: 0, w: 100, h: 100 }),
        makeText('b', 'Beta', { x: 100, y: 0, w: 100, h: 100 })
      ]
    })
    const text = describeRegion({ n: 2, slideId: 's9', path: rect(0, 0, 200, 100) }, slide, 1)
    expect(text).toContain('Region 2 on slide 1 (id s9) targets elements: ')
    expect(text).toContain('b (text "Beta"), a (text "Alpha")')
  })

  it('says so when the loop hits nothing', () => {
    const text = describeRegion(
      { n: 3, slideId: 's1', path: rect(900, 900, 50, 50) },
      makeSlide('s1'),
      2
    )
    expect(text).toBe(
      'Region 3 on slide 2 (id s1) targets no element. Region bbox: x 900, y 900, w 50, h 50.'
    )
  })

  it('rounds the bounding box to whole units', () => {
    const text = describeRegion(
      {
        n: 1,
        slideId: 's1',
        path: [
          [10.4, 20.6],
          [110.2, 20.6],
          [110.2, 80.9]
        ]
      },
      makeSlide('s1'),
      1
    )
    expect(text).toContain('Region bbox: x 10, y 21, w 100, h 60.')
  })
})
