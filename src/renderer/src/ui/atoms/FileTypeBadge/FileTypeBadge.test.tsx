import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FileTypeBadge, fileKindOf } from './FileTypeBadge'

describe('fileKindOf', () => {
  it.each([
    ['Unit 3.PDF', 'pdf'],
    ['deck.pptx', 'pptx'],
    ['LOs.docx', 'docx'],
    ['old.ppt', 'file'],
    ['photo.jpg', 'file'],
    ['README', 'file'],
    ['archive.pdf.zip', 'file']
  ])('classifies %s as %s', (name, kind) => {
    expect(fileKindOf(name)).toBe(kind)
  })
})

describe('FileTypeBadge', () => {
  it('shows the kind it is given', () => {
    render(<FileTypeBadge kind="pptx" />)
    expect(screen.getByText('pptx')).toHaveAttribute('data-kind', 'pptx')
  })

  it('classifies from a file name', () => {
    render(<FileTypeBadge fileName="Forces.pdf" />)
    expect(screen.getByText('pdf')).toHaveAttribute('data-kind', 'pdf')
  })

  it('falls back to a plain file badge', () => {
    render(<FileTypeBadge />)
    expect(screen.getByText('file')).toHaveAttribute('data-kind', 'file')
  })
})
