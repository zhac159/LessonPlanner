import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { StyleFile } from '@shared/contracts/style-library'
import { StyleFileRow, describeFileSize, type StyleFileRowProps } from './StyleFileRow'

const file = (over: Partial<StyleFile> = {}): StyleFile => ({
  id: 'f1',
  name: 'Y8 Photosynthesis.pptx',
  kind: 'pptx',
  units: 14,
  status: 'learned',
  mayContainNames: false,
  ...over
})

const renderRow = (f: StyleFile, props: Partial<StyleFileRowProps> = {}) =>
  render(
    <ul>
      <StyleFileRow file={f} {...props} />
    </ul>
  )

describe('describeFileSize', () => {
  it.each([
    [{ kind: 'pptx', units: 14 }, '14 slides'],
    [{ kind: 'pdf', units: 18 }, '18 pages'],
    [{ kind: 'pptx', units: 1 }, '1 slide'],
    [{ kind: 'pdf', units: 1 }, '1 page'],
    [{ kind: 'pdf', units: null }, '']
  ] as const)('%j is "%s"', (input, expected) => {
    expect(describeFileSize(input)).toBe(expected)
  })
})

describe('StyleFileRow', () => {
  it('shows the file name, type badge, size and status', () => {
    renderRow(file())
    const row = screen.getByRole('listitem')
    expect(within(row).getByText('Y8 Photosynthesis.pptx')).toHaveAttribute(
      'title',
      'Y8 Photosynthesis.pptx'
    )
    expect(within(row).getByText('pptx')).toBeInTheDocument()
    expect(within(row).getByText('14 slides')).toBeInTheDocument()
    expect(within(row).getByText('Learned')).toBeInTheDocument()
  })

  it('shows pages for a pdf and nothing for the size until it is counted', () => {
    const { rerender } = renderRow(file({ name: 'Y7 Cells.pdf', kind: 'pdf', units: 18 }))
    expect(screen.getByText('18 pages')).toBeInTheDocument()
    rerender(
      <ul>
        <StyleFileRow file={file({ kind: 'pdf', units: null, status: 'waiting' })} />
      </ul>
    )
    expect(screen.queryByText(/pages|slides/)).toBeNull()
  })

  it.each([
    ['waiting', 'Waiting'],
    ['reading', 'Reading…'],
    ['learned', 'Learned']
  ] as const)('labels a %s file "%s"', (status, label) => {
    renderRow(file({ status }))
    expect(screen.getByRole('listitem')).toHaveAttribute('data-status', status)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('shows "Couldn’t read" and the failure reason in place of the size', () => {
    renderRow(
      file({
        status: 'failed',
        error: { code: 'password', message: 'Password protected', retryable: false }
      })
    )
    expect(screen.getByText('Couldn’t read')).toBeInTheDocument()
    expect(screen.getByText('Password protected')).toHaveClass('is-error')
    expect(screen.queryByText('14 slides')).toBeNull()
  })

  it('removes with an accessibly named button and passes the file back', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const f = file()
    renderRow(f, { onRemove })
    await user.click(screen.getByRole('button', { name: 'Remove Y8 Photosynthesis.pptx' }))
    expect(onRemove).toHaveBeenCalledExactlyOnceWith(f)
  })

  it('can be removed with the keyboard', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    renderRow(file(), { onRemove })
    await user.tab()
    expect(screen.getByRole('button', { name: /^Remove/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('has no remove button when removal is not offered', () => {
    renderRow(file())
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offers "Try … again" only for a retryable failure', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const failed = file({
      status: 'failed',
      error: { code: 'network', message: 'Couldn’t reach Claude', retryable: true }
    })
    const { unmount } = renderRow(failed, { onRetry })
    await user.click(screen.getByRole('button', { name: 'Try Y8 Photosynthesis.pptx again' }))
    expect(onRetry).toHaveBeenCalledExactlyOnceWith(failed)
    unmount()

    renderRow(
      file({
        status: 'failed',
        error: { code: 'corrupt', message: 'This file is damaged', retryable: false }
      }),
      { onRetry }
    )
    expect(screen.queryByRole('button', { name: /again/ })).toBeNull()
  })

  it('warns about pupil names with an accessible icon', () => {
    renderRow(file({ mayContainNames: true }))
    expect(screen.getByRole('img', { name: 'May contain pupil names' })).toBeInTheDocument()
  })

  it('shows no names warning by default', () => {
    renderRow(file())
    expect(screen.queryByRole('img', { name: 'May contain pupil names' })).toBeNull()
  })
})
