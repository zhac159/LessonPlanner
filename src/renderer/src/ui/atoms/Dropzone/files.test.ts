import { describe, expect, it } from 'vitest'
import { dropMessage, isDragAcceptable, onlyMessage, splitByExtension } from './files'

const file = (name: string): File => new File(['x'], name)

describe('splitByExtension', () => {
  it('separates accepted and rejected files, ignoring case', () => {
    const { accepted, rejected } = splitByExtension(
      [file('a.PDF'), file('b.jpg'), file('c.pptx'), file('noext')],
      ['.pdf', '.pptx']
    )
    expect(accepted.map((f) => f.name)).toEqual(['a.PDF', 'c.pptx'])
    expect(rejected.map((f) => f.name)).toEqual(['b.jpg', 'noext'])
  })

  it('accepts everything without an accept list', () => {
    expect(splitByExtension([file('a.jpg')]).accepted).toHaveLength(1)
    expect(splitByExtension([file('a.jpg')], []).rejected).toHaveLength(0)
  })

  it('handles an empty drop', () => {
    expect(splitByExtension([], ['.pdf'])).toEqual({ accepted: [], rejected: [] })
  })
})

describe('isDragAcceptable', () => {
  const accept = ['.pdf', '.pptx']
  it('accepts known matching types and unknown types', () => {
    expect(isDragAcceptable(['application/pdf'], accept)).toBe(true)
    expect(isDragAcceptable(['application/pdf', ''], accept)).toBe(true)
  })
  it('rejects a known type that is not accepted', () => {
    expect(isDragAcceptable(['application/pdf', 'image/jpeg'], accept)).toBe(false)
  })
  it('accepts anything when no accept list or no known mime types', () => {
    expect(isDragAcceptable(['image/jpeg'])).toBe(true)
    expect(isDragAcceptable(['image/jpeg'], ['.xyz'])).toBe(true)
  })
})

describe('messages', () => {
  it('lists accepted extensions', () => {
    expect(onlyMessage(['.pdf', '.pptx'])).toBe('Only .pdf and .pptx files')
    expect(onlyMessage(['.pdf'])).toBe('Only .pdf files')
    expect(onlyMessage(['.pdf', '.pptx', '.docx'])).toBe('Only .pdf, .pptx and .docx files')
  })
  it('pluralises the drop message', () => {
    expect(dropMessage(1)).toBe('Drop to add 1 file')
    expect(dropMessage(3)).toBe('Drop to add 3 files')
  })
})
