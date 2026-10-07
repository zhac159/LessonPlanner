import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { lesson } from '../fixtures'
import { ALL_YEARS } from '../model/lessons'
import { PastLessons, type PastLessonsProps } from './PastLessons'

const NOW = new Date('2026-10-06T10:00:00')
const LESSONS = [
  lesson({ id: 'a', title: 'Photosynthesis', yearShort: 'Year 8', slideCount: 8 }),
  lesson({ id: 'b', title: 'Cells and organelles', yearShort: 'Year 7', slideCount: 10 })
]

function setup(props: Partial<PastLessonsProps> = {}) {
  const handlers = {
    onYear: vi.fn(),
    onSort: vi.fn(),
    onOpen: vi.fn(),
    onMenu: vi.fn(),
    onDelete: vi.fn(),
    onRetry: vi.fn(),
    onClearSearch: vi.fn()
  }
  render(
    <PastLessons
      status="ready"
      lessons={LESSONS}
      empty={{ kind: 'none' }}
      years={['Year 7', 'Year 8']}
      year={ALL_YEARS}
      sort="edited"
      now={NOW}
      selectedId={null}
      {...handlers}
      {...props}
    />
  )
  return handlers
}

describe('PastLessons', () => {
  it('shows the heading, the filters, the sort and a card per lesson', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Past lessons' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Filter by year group' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveValue('edited')
    const list = screen.getByRole('list', { name: 'Past lessons' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Photosynthesis' })).toBeInTheDocument()
  })

  it('offers the three sort orders and reports a change', async () => {
    const { onSort } = setup()
    const sort = screen.getByRole('combobox', { name: 'Sort' })
    expect(
      within(sort)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Last edited', 'Title A–Z', 'Year group'])
    await userEvent.selectOptions(sort, 'title')
    expect(onSort).toHaveBeenCalledWith('title')
  })

  it('opens a lesson from its card and its menu from the ⋯ button', async () => {
    const { onOpen, onMenu } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Photosynthesis' }))
    expect(onOpen).toHaveBeenCalledWith(LESSONS[0])
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Photosynthesis' }))
    expect(onMenu).toHaveBeenCalledWith(
      LESSONS[0],
      expect.objectContaining({ x: expect.any(Number) })
    )
  })

  it('asks to delete a focused card with the Delete key', async () => {
    const { onDelete } = setup()
    screen.getByRole('button', { name: 'Photosynthesis' }).focus()
    await userEvent.keyboard('{Delete}')
    expect(onDelete).toHaveBeenCalledWith(LESSONS[0])
  })

  it('shows skeletons and hides the filters and sort while loading', () => {
    setup({ status: 'loading', lessons: [] })
    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(8)
    expect(screen.getByTestId('lessons-loading')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter by year group' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Sort' })).not.toBeInTheDocument()
  })

  it('shows a recoverable error with Try again', async () => {
    const { onRetry } = setup({ status: 'error', lessons: [] })
    expect(screen.getByRole('alert')).toHaveTextContent('I couldn’t load your lessons.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state, without filters or sort, when there are no lessons', () => {
    setup({ lessons: [], empty: { kind: 'no-lessons' }, years: [] })
    expect(screen.getByText('No lessons yet')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Paste your objectives above and press Create lesson. Your lessons will appear here.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter by year group' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Sort' })).not.toBeInTheDocument()
  })

  it('shows "No lessons match" with Clear search', async () => {
    const { onClearSearch } = setup({ lessons: [], empty: { kind: 'no-match', query: 'zzz' } })
    expect(screen.getByText('No lessons match “zzz”')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onClearSearch).toHaveBeenCalledTimes(1)
  })

  it('names the year group when a filter has no lessons', () => {
    setup({ lessons: [], empty: { kind: 'no-year', year: 'Year 9' }, year: 'Year 9' })
    expect(screen.getByText('No Year 9 lessons yet.')).toBeInTheDocument()
  })

  it('renders a damaged lesson as a recoverable card next to the others', async () => {
    const { onRetry } = setup({
      lessons: [...LESSONS, lesson({ id: 'x', title: 'Broken', damaged: true })]
    })
    expect(screen.getByRole('article', { name: 'Broken' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('shows the first 48 lessons and more on request', async () => {
    const many = Array.from({ length: 60 }, (_, i) => lesson({ id: `m${i}`, title: `Lesson ${i}` }))
    setup({ lessons: many })
    const list = screen.getByRole('list', { name: 'Past lessons' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(48)
    await userEvent.click(screen.getByRole('button', { name: 'Show more lessons' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(60)
    expect(screen.queryByRole('button', { name: 'Show more lessons' })).not.toBeInTheDocument()
  })

  it('marks a lesson that is generating', () => {
    setup({ lessons: [lesson({ id: 'g', title: 'Fresh', status: 'generating' })] })
    expect(screen.getByText('Building…')).toBeInTheDocument()
  })
})
