import { describe, expect, it } from 'vitest'
import { makeText } from '@shared/deck/testing'
import type { Element, Paragraph } from '@shared/deck/types'
import {
  editableText,
  editorFontUnits,
  isEditableText,
  textChanged,
  textToParagraphs,
  type EditableElement
} from './textEdit'

const p = (text: string, extra: Partial<Paragraph> = {}): Paragraph => ({
  runs: [{ text }],
  ...extra
})

describe('textToParagraphs', () => {
  it('keeps a line that did not change, with all its runs', () => {
    const old: Paragraph[] = [
      { runs: [{ text: 'Two ' }, { text: 'colours', bold: true }] },
      p('second')
    ]
    const next = textToParagraphs(old, 'Two colours\nsecond edited')
    expect(next[0]).toBe(old[0])
    expect(next[1].runs).toEqual([{ text: 'second edited' }])
  })

  it('gives an edited line the formatting of the old paragraph’s first run', () => {
    const old: Paragraph[] = [{ runs: [{ text: 'Old', bold: true, color: '#ff0000' }] }]
    expect(textToParagraphs(old, 'New')[0].runs).toEqual([
      { bold: true, color: '#ff0000', text: 'New' }
    ])
  })

  it('copies list style and level to extra lines from the last old paragraph', () => {
    const old: Paragraph[] = [p('one', { list: 'bullet', level: 1 })]
    const next = textToParagraphs(old, 'one\ntwo\nthree')
    expect(next).toHaveLength(3)
    expect(next[2]).toMatchObject({ list: 'bullet', level: 1, runs: [{ text: 'three' }] })
  })

  it('drops lines that were deleted and accepts Windows line breaks', () => {
    const old = [p('a'), p('b'), p('c')]
    expect(textToParagraphs(old, 'a\r\nb')).toHaveLength(2)
  })

  it('works from nothing', () => {
    expect(textToParagraphs([], 'hello')).toEqual([{ runs: [{ text: 'hello' }] }])
  })
})

describe('text helpers', () => {
  const element = makeText('t', 'Line one\nLine two') as EditableElement

  it('joins paragraphs with line breaks', () => {
    expect(editableText(element)).toBe('Line one\nLine two')
  })

  it('detects a change, ignoring the line-break style', () => {
    expect(textChanged(element, 'Line one\nLine two')).toBe(false)
    expect(textChanged(element, 'Line one\r\nLine two')).toBe(false)
    expect(textChanged(element, 'Line one')).toBe(true)
  })

  it('edits unlocked text and callouts only', () => {
    expect(isEditableText(element)).toBe(true)
    expect(isEditableText(makeText('l', 'x', { locked: true }))).toBe(false)
    const image = { id: 'i', type: 'image', x: 0, y: 0, w: 1, h: 1 } as unknown as Element
    expect(isEditableText(image)).toBe(false)
    const callout = { id: 'c', type: 'callout', x: 0, y: 0, w: 1, h: 1, paragraphs: [p('hi')] }
    expect(isEditableText(callout as unknown as Element)).toBe(true)
  })

  it('sizes the editing box like the text it replaces', () => {
    expect(editorFontUnits(makeText('t', 'x', { fontSizePt: 30 }) as EditableElement)).toBe(60)
    expect(editorFontUnits(makeText('t', 'x', { role: 'title' }) as EditableElement)).toBe(84)
    expect(editorFontUnits(makeText('t', 'x', { role: 'caption' }) as EditableElement)).toBe(28)
    expect(editorFontUnits(makeText('t', 'x', { role: 'body' }) as EditableElement)).toBe(40)
  })
})
