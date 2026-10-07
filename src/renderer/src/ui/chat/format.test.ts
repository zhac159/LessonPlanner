import { describe, expect, it } from 'vitest'
import { attachmentKindOf, fileTypeLabel, formatFileSize } from './format'

describe('attachmentKindOf', () => {
  it.each([
    ['Y8 Photosynthesis LOs.docx', 'docx'],
    ['notes.PDF', 'pdf'],
    ['lesson.pptx', 'pptx'],
    ['leaf.png', 'image'],
    ['leaf.JPG', 'image'],
    ['leaf.jpeg', 'image'],
    ['readme.txt', 'file'],
    ['no-extension', 'file']
  ])('%s is %s', (name, kind) => {
    expect(attachmentKindOf(name)).toBe(kind)
  })
})

describe('fileTypeLabel', () => {
  it('uses plain English for every kind', () => {
    expect(fileTypeLabel('docx')).toBe('Word document')
    expect(fileTypeLabel('pdf')).toBe('PDF document')
    expect(fileTypeLabel('pptx')).toBe('PowerPoint presentation')
    expect(fileTypeLabel('image')).toBe('Image')
    expect(fileTypeLabel('file')).toBe('File')
  })
})

describe('formatFileSize', () => {
  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(48 * 1024 + 300)).toBe('48 KB')
    expect(formatFileSize(1.2 * 1024 * 1024)).toBe('1.2 MB')
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3 MB')
  })

  it('returns an empty string for invalid sizes', () => {
    expect(formatFileSize(-1)).toBe('')
    expect(formatFileSize(Number.NaN)).toBe('')
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe('')
  })
})
