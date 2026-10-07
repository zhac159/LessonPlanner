import { describe, expect, it } from 'vitest'
import { mergeLines, nearbyText, slideTextOf } from './nearText'

const item = (text: string, x: number, y: number, w = 200, h = 40) => ({
  text,
  box: { x, y, w, h }
})

describe('nearText', () => {
  const picture = { x: 500, y: 300, w: 400, h: 300 }

  it('takes the label under a picture and text on it, in reading order', () => {
    const items = [
      item('Title far away', 100, 20),
      item('wolf', 600, 620),
      item('Caption over', 520, 310),
      item('Footer', 100, 1000)
    ]
    expect(nearbyText(items, picture)).toBe('Caption over\nwolf')
  })

  it('ignores text well away and text boxes that only overlap the picture frame', () => {
    const items = [item('Far right', 1500, 400), item('Huge body', 0, 0, 1920, 1080)]
    expect(nearbyText(items, picture)).toBe('')
    expect(nearbyText(items, { x: 0, y: 0, w: 0, h: 0 })).toBe('')
  })

  it('caps the number of items and the length', () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      item(`label ${i}`, 520, 310 + i * 20, 100, 18)
    )
    expect(nearbyText(items, picture).split('\n').length).toBeLessThanOrEqual(6)
    expect(nearbyText([item('x'.repeat(500), 520, 310)], picture).length).toBe(200)
  })

  it('builds the whole slide text', () => {
    expect(slideTextOf([item('b', 0, 100), item('a', 0, 0), item('  ', 0, 50)])).toBe('a\nb')
  })

  it('merges fragments of one line and keeps separate lines apart', () => {
    const lines = mergeLines([
      item('Hello', 100, 100, 60, 20),
      item('world', 170, 100, 60, 20),
      item('Next line', 100, 140, 90, 20)
    ])
    expect(lines.map((l) => l.text)).toEqual(['Hello world', 'Next line'])
    expect(lines[0].box.w).toBe(130)
  })
})
