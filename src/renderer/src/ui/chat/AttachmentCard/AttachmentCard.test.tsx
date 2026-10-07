import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AttachmentCard } from './AttachmentCard'

describe('AttachmentCard', () => {
  it('shows the name and the plain-English type with the size', () => {
    render(<AttachmentCard name="Y8 Photosynthesis LOs.docx" sizeBytes={48 * 1024} />)
    expect(screen.getByRole('group', { name: 'Y8 Photosynthesis LOs.docx' })).toBeInTheDocument()
    expect(screen.getByText('Y8 Photosynthesis LOs.docx')).toBeInTheDocument()
    expect(screen.getByText('Word document · 48 KB')).toBeInTheDocument()
  })

  it('omits the size when unknown and tints the tile by kind', () => {
    const { container } = render(<AttachmentCard name="notes.pdf" />)
    expect(screen.getByText('PDF document')).toBeInTheDocument()
    expect(container.querySelector('.ui-attach__tile')).toHaveAttribute('data-kind', 'pdf')
  })

  it('treats pictures as images and lets the kind be set explicitly', () => {
    const { container, rerender } = render(<AttachmentCard name="leaf.png" />)
    expect(screen.getByText('Image')).toBeInTheDocument()
    expect(container.querySelector('.ui-attach__tile')).toHaveAttribute('data-kind', 'image')
    rerender(<AttachmentCard name="worksheet" kind="docx" icon="file-text" />)
    expect(screen.getByText('Word document')).toBeInTheDocument()
  })

  it('has no buttons when it is only her upload', () => {
    render(<AttachmentCard name="a.docx" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offers Open and Show in folder for a file the buddy made', async () => {
    const onOpen = vi.fn()
    const onShowInFolder = vi.fn()
    render(<AttachmentCard name="Quiz.docx" onOpen={onOpen} onShowInFolder={onShowInFolder} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await userEvent.click(screen.getByRole('button', { name: 'Show in folder' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onShowInFolder).toHaveBeenCalledTimes(1)
  })

  it('removes a staged file with a named × button, by keyboard too', async () => {
    const onRemove = vi.fn()
    render(<AttachmentCard name="a.docx" onRemove={onRemove} />)
    const remove = screen.getByRole('button', { name: 'Remove a.docx' })
    remove.focus()
    await userEvent.keyboard('{Enter}')
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('says Uploading… while uploading', () => {
    render(<AttachmentCard name="a.docx" status="uploading" />)
    expect(screen.getByText('Uploading…')).toBeInTheDocument()
  })

  it('says Reading… then shows a detail when given', () => {
    const { rerender } = render(<AttachmentCard name="a.docx" status="reading" />)
    expect(screen.getByText('Reading…')).toBeInTheDocument()
    rerender(<AttachmentCard name="a.docx" detail="3 objectives found" />)
    expect(screen.getByText('3 objectives found')).toBeInTheDocument()
  })

  it('shows an error pill instead of the type line on error', () => {
    render(<AttachmentCard name="a.docx" status="error" />)
    expect(screen.getByText('Couldn’t read this file')).toBeInTheDocument()
    expect(screen.queryByText('Word document')).toBeNull()
  })
})
