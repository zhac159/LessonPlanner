import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReviewFileRow, ReviewMoreRow } from './ReviewFileRow'

const inList = (node: React.ReactNode) => render(<ul>{node}</ul>)

describe('ReviewFileRow', () => {
  it('shows the type badge, the file name and how many were found', () => {
    inList(<ReviewFileRow fileName="Y8 Photosynthesis.pptx" state="done" found={4} />)
    expect(screen.getByText('pptx')).toBeInTheDocument()
    expect(screen.getByText('Y8 Photosynthesis.pptx')).toBeInTheDocument()
    expect(screen.getByText('4 found')).toBeInTheDocument()
  })

  it('classifies a PDF', () => {
    inList(<ReviewFileRow fileName="Y7 Cells and organelles.pdf" state="done" found={3} />)
    expect(screen.getByText('pdf')).toBeInTheDocument()
  })

  it('shows a progress bar with the stage while working', () => {
    inList(
      <ReviewFileRow
        fileName="Y7 icon sheet.pdf"
        state="working"
        progress={{ done: 4, total: 6, label: 'Cutting out pictures · page 4 of 6' }}
      />
    )
    const bar = screen.getByRole('progressbar', { name: 'Cutting out pictures · page 4 of 6' })
    expect(bar).toHaveAttribute('aria-valuenow', '4')
    expect(bar).toHaveAttribute('aria-valuemax', '6')
    expect(screen.queryByText(/found/)).toBeNull()
  })

  it('says "Waiting" before a file starts', () => {
    inList(<ReviewFileRow fileName="a.pptx" state="waiting" />)
    expect(screen.getByText('Waiting')).toBeInTheDocument()
  })

  it("a failed file says 'Couldn't read', why, and offers 'Try again'", async () => {
    const onRetry = vi.fn()
    inList(
      <ReviewFileRow
        fileName="Scan.pdf"
        state="failed"
        error="This PDF is only scanned pages, so there's nothing to cut out."
        onRetry={onRetry}
      />
    )
    expect(screen.getByText("Couldn't read")).toBeInTheDocument()
    expect(
      screen.getByText("This PDF is only scanned pages, so there's nothing to cut out.")
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('a failed file without a retry or reason shows just the pill', () => {
    inList(<ReviewFileRow fileName="Scan.pdf" state="failed" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('ReviewMoreRow', () => {
  it('shows "+5", "5 more decks" and "3 found" and toggles', async () => {
    const onToggle = vi.fn()
    inList(<ReviewMoreRow count={5} found={3} onToggle={onToggle} />)
    const button = screen.getByRole('button', { name: /5 more decks/ })
    expect(button).toHaveTextContent('+5')
    expect(button).toHaveTextContent('3 found')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('uses the singular and shows expanded', () => {
    inList(<ReviewMoreRow count={1} found={1} expanded onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: /1 more deck\b/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })
})
