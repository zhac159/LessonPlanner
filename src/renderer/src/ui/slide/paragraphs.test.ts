import { describe, expect, it } from 'vitest'
import type { Paragraph } from '@shared/deck/types'
import { isList, isListOnly, listNumbers, withLabel } from './paragraphs'

const p = (list?: Paragraph['list'], level?: 0 | 1 | 2, text = 'x'): Paragraph => ({
  runs: [{ text }],
  list,
  level
})

describe('listNumbers', () => {
  it('numbers consecutive numbered paragraphs and skips others', () => {
    expect(listNumbers([p('number'), p('number'), p('bullet'), p('number')])).toEqual([
      1,
      2,
      null,
      1
    ])
  })

  it('counts levels independently and restarts deeper levels', () => {
    const items = [p('number', 0), p('number', 1), p('number', 1), p('number', 0), p('number', 1)]
    expect(listNumbers(items)).toEqual([1, 1, 2, 2, 1])
  })

  it('restarts after a plain paragraph', () => {
    expect(listNumbers([p('number'), p(undefined), p('number')])).toEqual([1, null, 1])
  })

  it('handles empty input', () => {
    expect(listNumbers([])).toEqual([])
  })
})

describe('list detection', () => {
  it('knows list paragraphs', () => {
    expect(isList(p('bullet'))).toBe(true)
    expect(isList(p('checkbox'))).toBe(true)
    expect(isList(p('none'))).toBe(false)
    expect(isList(p())).toBe(false)
  })

  it('isListOnly needs every paragraph to be a list item', () => {
    expect(isListOnly([p('bullet'), p('number')])).toBe(true)
    expect(isListOnly([p('bullet'), p()])).toBe(false)
    expect(isListOnly([])).toBe(false)
  })
})

describe('withLabel', () => {
  it('prepends a bold label run to the first paragraph', () => {
    const out = withLabel(
      [p(undefined, undefined, 'Question?'), p(undefined, undefined, 'More')],
      'Mini-whiteboards:'
    )
    expect(out[0].runs).toEqual([
      { text: 'Mini-whiteboards:', bold: true },
      { text: ' ' },
      { text: 'Question?' }
    ])
    expect(out).toHaveLength(2)
  })

  it('creates a paragraph when there is none', () => {
    expect(withLabel([], 'Label:')).toEqual([{ runs: [{ text: 'Label:', bold: true }] }])
  })

  it('returns a copy unchanged without a label', () => {
    const input = [p()]
    const out = withLabel(input, undefined)
    expect(out).toEqual(input)
    expect(out).not.toBe(input)
  })
})
