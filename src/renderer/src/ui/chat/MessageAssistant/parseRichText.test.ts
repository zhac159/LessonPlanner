import { describe, expect, it } from 'vitest'
import { parseInline, parseRichText } from './parseRichText'

describe('parseInline', () => {
  it('splits bold runs from plain text', () => {
    expect(parseInline('Done! **8 slides** made')).toEqual([
      { text: 'Done! ', bold: false },
      { text: '8 slides', bold: true },
      { text: ' made', bold: false }
    ])
  })

  it('leaves unpaired markers as plain text', () => {
    expect(parseInline('a ** b')).toEqual([{ text: 'a ** b', bold: false }])
  })

  it('returns nothing for an empty line', () => {
    expect(parseInline('')).toEqual([])
  })
})

describe('parseRichText', () => {
  it('returns no blocks for empty or blank text', () => {
    expect(parseRichText('')).toEqual([])
    expect(parseRichText(' \n\n  ')).toEqual([])
  })

  it('separates paragraphs on blank lines and keeps single line breaks', () => {
    const blocks = parseRichText('one\ntwo\n\nthree')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({
      type: 'p',
      lines: [[{ text: 'one', bold: false }], [{ text: 'two', bold: false }]]
    })
  })

  it('groups consecutive bullets (-, *, •) into one list', () => {
    const blocks = parseRichText('Do:\n- a\n* b\n• **c**')
    expect(blocks.map((b) => b.type)).toEqual(['p', 'ul'])
    const list = blocks[1]
    expect(list?.type === 'ul' && list.items).toEqual([
      [{ text: 'a', bold: false }],
      [{ text: 'b', bold: false }],
      [{ text: 'c', bold: true }]
    ])
  })

  it('starts a new list after a paragraph and handles Windows line endings', () => {
    const blocks = parseRichText('- a\r\ntext\r\n- b')
    expect(blocks.map((b) => b.type)).toEqual(['ul', 'p', 'ul'])
  })

  it('keeps HTML-looking text as plain text', () => {
    expect(parseRichText('<script>x</script>')).toEqual([
      { type: 'p', lines: [[{ text: '<script>x</script>', bold: false }]] }
    ])
  })
})
