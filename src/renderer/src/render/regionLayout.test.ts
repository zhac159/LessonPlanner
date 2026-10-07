import { describe, expect, it } from 'vitest'
import { LABEL_GAP, LABEL_SIZE, labelPosition, pathData, toPixels } from './regionLayout'

const full = { viewport: { x: 0, y: 0, w: 1920, h: 1080 }, scale: 0.5 }
const image = { width: 960, height: 540 }

describe('toPixels', () => {
  it('scales slide units to pixels', () => {
    expect(toPixels([1000, 400], full)).toEqual([500, 200])
  })

  it('measures from the top-left of a crop', () => {
    expect(
      toPixels([1000, 400], { viewport: { x: 900, y: 300, w: 400, h: 300 }, scale: 2 })
    ).toEqual([200, 200])
  })
})

describe('pathData', () => {
  const path: Array<[number, number]> = [
    [100, 100],
    [300, 100],
    [300, 300]
  ]

  it('closes a loop and leaves a stroke open', () => {
    expect(pathData(path, full, true)).toBe('M 50 50 L 150 50 L 150 150 Z')
    expect(pathData(path, full, false)).toBe('M 50 50 L 150 50 L 150 150')
  })

  it('rounds to two decimals', () => {
    expect(
      pathData(
        [
          [1, 1],
          [2, 2]
        ],
        { viewport: full.viewport, scale: 1 / 3 },
        false
      )
    ).toBe('M 0.33 0.33 L 0.67 0.67')
  })

  it('is empty for fewer than two points', () => {
    expect(pathData([], full, true)).toBe('')
    expect(pathData([[5, 5]], full, false)).toBe('')
  })
})

describe('labelPosition', () => {
  const bboxAt = (x: number, y: number) => ({ bbox: { x, y, w: 400, h: 300 } })

  it('sits 6px above the box, 2% of the image width to its left', () => {
    const position = labelPosition(bboxAt(1000, 600), full, image)
    expect(position.top).toBe(300 - LABEL_GAP - LABEL_SIZE.height)
    expect(position.left).toBe(Math.round(500 - 960 * 0.02))
  })

  it('stays inside the image at the top-left corner', () => {
    expect(labelPosition(bboxAt(0, 0), full, image)).toEqual({ left: 0, top: 0 })
  })

  it('stays inside the image at the right edge', () => {
    const position = labelPosition(bboxAt(1900, 1070), full, image)
    expect(position.left).toBe(image.width - LABEL_SIZE.width)
    expect(position.top).toBe(535 - LABEL_GAP - LABEL_SIZE.height)
  })

  it('works in a crop, measuring from the crop origin', () => {
    const crop = { viewport: { x: 900, y: 300, w: 600, h: 480 }, scale: 1 }
    const position = labelPosition(bboxAt(1000, 500), crop, { width: 600, height: 480 })
    expect(position.top).toBe(200 - LABEL_GAP - LABEL_SIZE.height)
    expect(position.left).toBe(100 - 12)
  })

  it('pins a label to the corner when the box is left of the crop', () => {
    const crop = { viewport: { x: 900, y: 300, w: 600, h: 480 }, scale: 1 }
    expect(labelPosition(bboxAt(0, 0), crop, { width: 600, height: 480 })).toEqual({
      left: 0,
      top: 0
    })
  })
})
