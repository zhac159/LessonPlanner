import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { lesson } from '../testing'
import { PastLessonDialog, matchLessons, type PastLessonDialogProps } from './PastLessonDialog'

const lessons = [
  lesson(),
  lesson({ id: 'les_2', title: 'Y9 Chemistry — Acids', yearShort: 'Year 9' }),
  lesson({ id: 'les_3', title: 'Form time — Kindness', yearShort: 'Form' })
]

function setup(props: Partial<PastLessonDialogProps> = {}) {
  const onClose = vi.fn()
  const onUse = vi.fn()
  render(
    <PastLessonDialog
      open
      status="ready"
      lessons={lessons}
      onClose={onClose}
      onUse={onUse}
      {...props}
    />
  )
  return { onClose, onUse, user: userEvent.setup() }
}

describe('matchLessons', () => {
  it('matches titles case-insensitively and ignores surrounding spaces', () => {
    expect(matchLessons(lessons, '  ACIDS ').map((l) => l.id)).toEqual(['les_2'])
    expect(matchLessons(lessons, '')).toHaveLength(3)
    expect(matchLessons(lessons, 'zzz')).toEqual([])
  })
})

describe('PastLessonDialog', () => {
  it('renders nothing while closed', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is a titled dialog with a search field in focus and a disabled Use button', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: 'Start from a past lesson' })
    expect(within(dialog).getByRole('searchbox', { name: 'Search lessons' })).toHaveFocus()
    expect(within(dialog).getByRole('button', { name: 'Use this lesson' })).toBeDisabled()
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(3)
  })

  it('filters as she types and says when nothing matches', async () => {
    const { user } = setup()
    await user.type(screen.getByRole('searchbox'), 'chem')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText('No lessons match “zzz”.')).toBeInTheDocument()
  })

  it('selects a card, announces it, and uses it from the button', async () => {
    const { user, onUse } = setup()
    await user.click(screen.getByRole('button', { name: /Y9 Chemistry/ }))
    expect(screen.getByRole('status')).toHaveTextContent('Y9 Chemistry — Acids selected')
    await user.click(screen.getByRole('button', { name: 'Use this lesson' }))
    expect(onUse).toHaveBeenCalledWith('les_2')
  })

  it('uses a card straight away on double-click', async () => {
    const { user, onUse } = setup()
    await user.dblClick(screen.getByRole('button', { name: /Form time — Kindness/ }))
    expect(onUse).toHaveBeenCalledWith('les_3')
  })

  it('shows loading, empty and error states', () => {
    const { rerender } = render(
      <PastLessonDialog open status="loading" lessons={[]} onClose={vi.fn()} onUse={vi.fn()} />
    )
    expect(screen.getByText('Loading your lessons…')).toBeInTheDocument()
    rerender(
      <PastLessonDialog open status="ready" lessons={[]} onClose={vi.fn()} onUse={vi.fn()} />
    )
    expect(screen.getByText('You haven’t made any lessons yet.')).toBeInTheDocument()
    rerender(
      <PastLessonDialog open status="error" lessons={[]} onClose={vi.fn()} onUse={vi.fn()} />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('I couldn’t load your lessons.')
  })

  it('locks while the copy is made', async () => {
    const { user, onUse, onClose } = setup({ copying: true })
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.dblClick(screen.getByRole('button', { name: /Y8 Science/ }))
    expect(onUse).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes with Cancel', async () => {
    const { user, onClose } = setup()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
