import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { lesson, style } from './testSupport'
import { renderHome } from './renderHome'

const LESSONS = [
  lesson({ id: 'a', title: 'Photosynthesis', yearGroup: 'Year 8', yearShort: 'Year 8' }),
  lesson({ id: 'b', title: 'Cells and organelles', yearGroup: 'Year 7', yearShort: 'Year 7' }),
  lesson({ id: 'c', title: 'Photo editing basics', yearGroup: 'Year 7', yearShort: 'Year 7' })
]
const STYLES = [style(), style({ id: 's2', name: 'Photo club', isDefault: false })]

const grid = () => screen.getByRole('list', { name: 'Past lessons' })
const search = () => screen.getByRole('searchbox', { name: 'Search lessons and styles' })

async function loaded() {
  const view = renderHome({ lessons: LESSONS, styles: STYLES })
  await screen.findByRole('button', { name: 'Photosynthesis' })
  return view
}

describe('HomeView search', () => {
  it('filters lessons and styles live after a short pause', async () => {
    const { user } = await loaded()
    await user.type(search(), 'PHOTO')
    await waitFor(() => expect(within(grid()).getAllByRole('listitem')).toHaveLength(2))
    expect(screen.queryByRole('button', { name: 'Cells and organelles' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Photo club' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Science KS3' })).not.toBeInTheDocument()
  })

  it('announces the counts politely', async () => {
    const { user } = await loaded()
    await user.type(search(), 'photo')
    const status = await screen.findByText('2 lessons, 1 styles')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('matches without caring about case or accents', async () => {
    const { user } = await loaded()
    await user.type(search(), 'cëlls')
    await waitFor(() => expect(within(grid()).getAllByRole('listitem')).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Cells and organelles' })).toBeInTheDocument()
  })

  it('stacks with the year filter', async () => {
    const { user } = await loaded()
    await user.click(screen.getByRole('button', { name: 'Year 7' }))
    await user.type(search(), 'photo')
    await waitFor(() => expect(within(grid()).getAllByRole('listitem')).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Photo editing basics' })).toBeInTheDocument()
  })

  it('shows "No lessons match" with Clear search when nothing fits', async () => {
    const { user } = await loaded()
    await user.type(search(), 'zzz')
    expect(await screen.findByText('No lessons match “zzz”')).toBeInTheDocument()
    expect(screen.getByText('No styles match “zzz”')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(search()).toHaveValue('')
    expect(await screen.findByRole('button', { name: 'Photosynthesis' })).toBeInTheDocument()
  })

  it('Esc clears the search, and blurs when it is already empty', async () => {
    const { user } = await loaded()
    await user.type(search(), 'photo')
    await waitFor(() => expect(within(grid()).getAllByRole('listitem')).toHaveLength(2))
    await user.keyboard('{Escape}')
    expect(search()).toHaveValue('')
    await waitFor(() => expect(within(grid()).getAllByRole('listitem')).toHaveLength(3))
    expect(search()).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(search()).not.toHaveFocus()
  })

  it('Ctrl+F focuses the search from anywhere on the page', async () => {
    const { user } = await loaded()
    await user.click(screen.getByRole('textbox', { name: 'Learning objectives' }))
    await user.keyboard('{Control>}f{/Control}')
    expect(search()).toHaveFocus()
  })
})
