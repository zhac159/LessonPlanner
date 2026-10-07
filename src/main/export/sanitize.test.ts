import { describe, expect, it } from 'vitest'
import { dropMisplacedParagraphProps } from './normalise'
import { cleanInline, cleanText } from './sanitize'

describe('cleanText / cleanInline', () => {
  it('removes characters XML 1.0 forbids but keeps tabs, newlines and emoji', () => {
    expect(cleanText('a\u0000b\u0008c\u000Bd\u001Fe￾f')).toBe('abcdef')
    expect(cleanText('tab\there\nnew 😀')).toBe('tab\there\nnew 😀')
  })

  it('drops lone surrogates but keeps proper pairs', () => {
    expect(cleanText('x\uD800y')).toBe('xy')
    expect(cleanText('x\uDC00y')).toBe('xy')
    expect(cleanText('😀')).toBe('😀')
  })

  it('normalises line endings and flattens them inline', () => {
    expect(cleanText('a\r\nb\rc')).toBe('a\nb\nc')
    expect(cleanInline('a\r\n\r\nb\nc')).toBe('a b c')
  })
})

describe('dropMisplacedParagraphProps', () => {
  const pPr = '<a:pPr algn="l" indent="0" marL="0"><a:buNone/></a:pPr>'

  it('keeps the leading pPr and drops the ones between runs', () => {
    const xml = `<a:p>${pPr}<a:r><a:t>a</a:t></a:r>${pPr}<a:r><a:t>b</a:t></a:r></a:p>`
    expect(dropMisplacedParagraphProps(xml)).toBe(
      `<a:p>${pPr}<a:r><a:t>a</a:t></a:r><a:r><a:t>b</a:t></a:r></a:p>`
    )
  })

  it('handles self-closing pPr and paragraphs without any', () => {
    const xml =
      '<a:p><a:pPr algn="l"/><a:r><a:t>a</a:t></a:r><a:pPr algn="r"/><a:r><a:t>b</a:t></a:r></a:p><a:p><a:r><a:t>c</a:t></a:r></a:p>'
    expect(dropMisplacedParagraphProps(xml)).toBe(
      '<a:p><a:pPr algn="l"/><a:r><a:t>a</a:t></a:r><a:r><a:t>b</a:t></a:r></a:p><a:p><a:r><a:t>c</a:t></a:r></a:p>'
    )
  })

  it('treats every paragraph separately', () => {
    const xml = `<a:p>${pPr}<a:r><a:t>1</a:t></a:r></a:p><a:p>${pPr}<a:r><a:t>2</a:t></a:r></a:p>`
    expect(dropMisplacedParagraphProps(xml)).toBe(xml)
  })

  it('leaves text that merely looks similar alone', () => {
    const xml = '<a:p><a:r><a:t>&lt;a:pPr&gt;</a:t></a:r></a:p>'
    expect(dropMisplacedParagraphProps(xml)).toBe(xml)
  })
})
