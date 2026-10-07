import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { StyleProfile } from '../style/types'
import {
  chipLayoutStyle,
  estimateTextWidth,
  layoutChips,
  ptToUnits,
  unitsToInches,
  unitsToPt
} from './layout'

const style = JSON.parse(
  readFileSync('design/fixtures/style-profile.science-ks3.json', 'utf8')
) as StyleProfile
const box = { x: 125, y: 740, w: 940, h: 60 }

describe('unit conversions', () => {
  it('maps 1920 units to 13.333 inches and 1 pt to 2 units', () => {
    expect(unitsToInches(1920)).toBeCloseTo(13.3333, 3)
    expect(unitsToInches(1080)).toBeCloseTo(7.5, 5)
    expect(unitsToInches(0)).toBe(0)
    expect(ptToUnits(40)).toBe(80)
    expect(unitsToPt(ptToUnits(18))).toBe(18)
  })
})

describe('estimateTextWidth', () => {
  it('is zero for empty text and grows with length and size', () => {
    expect(estimateTextWidth('', 15)).toBe(0)
    expect(estimateTextWidth('abcd', 15)).toBeGreaterThan(estimateTextWidth('ab', 15))
    expect(estimateTextWidth('abcd', 30)).toBeCloseTo(2 * estimateTextWidth('abcd', 15), 6)
  })

  it('makes bold text wider and narrow letters narrower than wide ones', () => {
    expect(estimateTextWidth('glucose', 15, true)).toBeGreaterThan(estimateTextWidth('glucose', 15))
    expect(estimateTextWidth('iiii', 15)).toBeLessThan(estimateTextWidth('mmmm', 15))
    expect(estimateTextWidth('WWWW', 15)).toBeGreaterThan(estimateTextWidth('wwww', 15) - 1)
  })

  it('counts digits, capitals, spaces and CJK characters', () => {
    expect(estimateTextWidth('A', 10)).toBeGreaterThan(estimateTextWidth('a', 10))
    expect(estimateTextWidth('1', 10)).toBeGreaterThan(estimateTextWidth('l', 10))
    expect(estimateTextWidth('a b', 10)).toBeGreaterThan(estimateTextWidth('ab', 10))
    expect(estimateTextWidth('水', 10)).toBeCloseTo(20, 6)
  })

  it('is deterministic', () => {
    expect(estimateTextWidth('chlorophyll', 15, true)).toBe(
      estimateTextWidth('chlorophyll', 15, true)
    )
  })
})

describe('chipLayoutStyle', () => {
  it('reads the chip component from the profile', () => {
    expect(chipLayoutStyle(style)).toMatchObject({ fontSizePt: 15, bold: true, padY: 12, padX: 27 })
  })

  it('falls back to defaults without a profile or component', () => {
    expect(chipLayoutStyle(null)).toMatchObject({ fontSizePt: 15, padY: 12, padX: 27 })
    expect(chipLayoutStyle(style, 'nope')).toMatchObject({ fontSizePt: 15, bold: true })
  })
})

describe('layoutChips', () => {
  it('returns nothing for no items', () => {
    expect(layoutChips([], box, style)).toEqual([])
  })

  it('lays the fixture key words in one row, 60 units tall like the design', () => {
    const rects = layoutChips(['chlorophyll', 'glucose', 'endothermic'], box, style)
    expect(rects.map((r) => r.text)).toEqual(['chlorophyll', 'glucose', 'endothermic'])
    expect(new Set(rects.map((r) => r.y))).toEqual(new Set([740]))
    expect(rects.every((r) => r.h === 60)).toBe(true)
    expect(rects[0].x).toBe(125)
    expect(rects[1].x).toBe(rects[0].x + rects[0].w + 18)
    const last = rects[2]
    expect(last.x + last.w).toBeLessThanOrEqual(box.x + box.w)
  })

  it('wraps to a new row, left-aligned, when the next pill would cross the right edge', () => {
    const narrow = { x: 100, y: 200, w: 400, h: 200 }
    const rects = layoutChips(
      ['photosynthesis', 'chlorophyll', 'glucose', 'endothermic'],
      narrow,
      style
    )
    const rows = [...new Set(rects.map((r) => r.y))]
    expect(rows.length).toBeGreaterThan(1)
    for (const r of rects) expect(r.x + r.w).toBeLessThanOrEqual(narrow.x + narrow.w)
    const firstOfSecondRow = rects.find((r) => r.y === rows[1])!
    expect(firstOfSecondRow.x).toBe(narrow.x)
    expect(rows[1]).toBe(rows[0] + rects[0].h + 18)
  })

  it('clamps a pill wider than the box to the box width instead of looping', () => {
    const [rect] = layoutChips(
      ['a very long key word that cannot possibly fit'],
      { x: 0, y: 0, w: 200, h: 60 },
      style
    )
    expect(rect.w).toBe(200)
    expect(rect.x).toBe(0)
  })

  it('uses integer coordinates and the same output for the same input', () => {
    const a = layoutChips(['one', 'two', 'three'], box, style)
    expect(a).toEqual(layoutChips(['one', 'two', 'three'], box, style))
    for (const r of a) for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true)
  })

  it('works without a style profile', () => {
    expect(layoutChips(['x'], box, null)).toHaveLength(1)
  })
})
