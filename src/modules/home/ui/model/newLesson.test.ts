import { describe, expect, it } from 'vitest'
import { canCreate, initialLength, rejectedMessage, rejectOnClient } from './newLesson'

describe('initialLength', () => {
  it('uses the last length when it is offered, else 50', () => {
    expect(initialLength(45)).toBe(45)
    expect(initialLength(null)).toBe(50)
    expect(initialLength(undefined)).toBe(50)
    expect(initialLength(55)).toBe(50)
  })
})

describe('canCreate', () => {
  it('needs non-space text or a document', () => {
    expect(canCreate('', false)).toBe(false)
    expect(canCreate('   \n ', false)).toBe(false)
    expect(canCreate('LO1', false)).toBe(true)
    expect(canCreate('', true)).toBe(true)
  })
})

describe('rejectOnClient', () => {
  it('flags .ppt as too old and everything else as the wrong type', () => {
    expect(rejectOnClient([{ name: 'a.PPT' }, { name: 'b.jpg' }, { name: 'noext' }])).toEqual([
      { name: 'a.PPT', reason: 'old-ppt' },
      { name: 'b.jpg', reason: 'type' },
      { name: 'noext', reason: 'type' }
    ])
  })
})

describe('rejectedMessage', () => {
  it('is empty when nothing was rejected', () => {
    expect(rejectedMessage([])).toBe('')
  })

  it('counts wrong-type files with the right plural', () => {
    expect(rejectedMessage([{ name: 'a.jpg', reason: 'type' }])).toBe(
      'Skipped 1 file that isn’t PDF or PowerPoint.'
    )
    expect(
      rejectedMessage([
        { name: 'a.jpg', reason: 'type' },
        { name: 'b.png', reason: 'type' }
      ])
    ).toBe('Skipped 2 files that aren’t PDF or PowerPoint.')
  })

  it('names too-large files and explains .ppt and the file limit', () => {
    const message = rejectedMessage([
      { name: 'huge.pdf', reason: 'too-large' },
      { name: 'old.ppt', reason: 'old-ppt' },
      { name: 'x.pdf', reason: 'limit' }
    ])
    expect(message).toContain('Only the first 50 files were added.')
    expect(message).toContain('huge.pdf is over 50 MB, so I skipped it.')
    expect(message).toContain('.ppt files are too old to read. Save them as .pptx first.')
  })

  it('mentions duplicates', () => {
    expect(rejectedMessage([{ name: 'a.pdf', reason: 'duplicate' }])).toBe(
      'Skipped 1 file that was already added.'
    )
  })
})
