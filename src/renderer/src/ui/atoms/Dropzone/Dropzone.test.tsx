import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dropzone, type DropzoneProps } from './Dropzone'

const pdf = new File(['x'], 'unit.pdf', { type: 'application/pdf' })
const jpg = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })

function setup(props: Partial<DropzoneProps> = {}) {
  const onFiles = vi.fn()
  const onRejected = vi.fn()
  const onBrowse = vi.fn()
  render(
    <Dropzone
      title="Create a new style"
      description="Drop old PDFs here, or browse files"
      meta=".pdf and .pptx · up to 50 files"
      accept={['.pdf', '.pptx']}
      onFiles={onFiles}
      onRejected={onRejected}
      onBrowse={onBrowse}
      {...props}
    />
  )
  return { onFiles, onRejected, onBrowse, zone: screen.getByRole('button') }
}

const dataTransfer = (files: File[]) => ({
  files,
  items: files.map((file) => ({ kind: 'file', type: file.type }))
})

describe('Dropzone', () => {
  it('is a button named by its text, with the large variant by default', () => {
    const { zone } = setup()
    expect(zone).toHaveAccessibleName(/Create a new style/)
    expect(zone).toHaveAttribute('data-variant', 'large')
    expect(screen.getByText('.pdf and .pptx · up to 50 files')).toBeInTheDocument()
  })

  it('opens the file picker on click, Enter and Space', async () => {
    const user = userEvent.setup()
    const { onBrowse } = setup()
    await user.tab()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    await user.click(screen.getByRole('button'))
    expect(onBrowse).toHaveBeenCalledTimes(3)
  })

  it('passes accepted dropped files and rejects the rest separately', () => {
    const { zone, onFiles, onRejected } = setup()
    fireEvent.drop(zone, { dataTransfer: dataTransfer([pdf, jpg]) })
    expect(onFiles).toHaveBeenCalledWith([pdf])
    expect(onRejected).toHaveBeenCalledWith([jpg])
  })

  it('does not call onFiles when nothing is acceptable', () => {
    const { zone, onFiles, onRejected } = setup()
    fireEvent.drop(zone, { dataTransfer: dataTransfer([jpg]) })
    expect(onFiles).not.toHaveBeenCalled()
    expect(onRejected).toHaveBeenCalledWith([jpg])
  })

  it('shows a yellow "Drop to add n files" state while dragging valid files, then resets', () => {
    const { zone } = setup()
    fireEvent.dragEnter(zone, { dataTransfer: dataTransfer([pdf, pdf, pdf]) })
    expect(zone).toHaveAttribute('data-drag', 'valid')
    expect(screen.getByText('Drop to add 3 files')).toBeInTheDocument()
    fireEvent.dragLeave(zone)
    expect(zone).toHaveAttribute('data-drag', 'idle')
    expect(screen.getByText('Create a new style')).toBeInTheDocument()
  })

  it('shows the "Only .pdf and .pptx files" state for files it cannot take', () => {
    const { zone } = setup()
    fireEvent.dragEnter(zone, { dataTransfer: dataTransfer([jpg]) })
    expect(zone).toHaveAttribute('data-drag', 'invalid')
    expect(screen.getByText('Only .pdf and .pptx files')).toBeInTheDocument()
  })

  it('does not flicker when the drag passes over child elements', () => {
    const { zone } = setup()
    const child = screen.getByText('Create a new style')
    fireEvent.dragEnter(zone, { dataTransfer: dataTransfer([pdf]) })
    fireEvent.dragEnter(child, { dataTransfer: dataTransfer([pdf]) })
    fireEvent.dragLeave(zone)
    expect(zone).toHaveAttribute('data-drag', 'valid')
    fireEvent.dragLeave(child)
    expect(zone).toHaveAttribute('data-drag', 'idle')
  })

  it('announces drag messages politely', () => {
    setup()
    expect(screen.getByText('Create a new style')).toHaveAttribute('aria-live', 'polite')
  })

  it('ignores clicks and drops when disabled', async () => {
    const { zone, onBrowse, onFiles } = setup({ disabled: true })
    await userEvent.click(zone)
    fireEvent.drop(zone, { dataTransfer: dataTransfer([pdf]) })
    expect(zone).toBeDisabled()
    expect(onBrowse).not.toHaveBeenCalled()
    expect(onFiles).not.toHaveBeenCalled()
  })

  it('shows the loading label, is busy, and ignores input while loading', async () => {
    const { zone, onBrowse, onFiles } = setup({ loading: true, loadingLabel: 'Adding 3 files…' })
    expect(zone).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Adding 3 files…')).toBeInTheDocument()
    await userEvent.click(zone)
    fireEvent.drop(zone, { dataTransfer: dataTransfer([pdf]) })
    expect(onBrowse).not.toHaveBeenCalled()
    expect(onFiles).not.toHaveBeenCalled()
  })

  it('supports compact and chat variants', () => {
    const { zone } = setup({ variant: 'compact' })
    expect(zone).toHaveAttribute('data-variant', 'compact')
  })

  it('accepts everything when no accept list is given', () => {
    const { zone, onFiles, onRejected } = setup({ accept: undefined })
    fireEvent.drop(zone, { dataTransfer: dataTransfer([jpg]) })
    expect(onFiles).toHaveBeenCalledWith([jpg])
    expect(onRejected).not.toHaveBeenCalled()
  })
})
