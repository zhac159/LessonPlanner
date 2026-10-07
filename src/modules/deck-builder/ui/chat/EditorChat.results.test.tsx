import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fixtureDeck } from '@shared/deck/testing'
import { ok } from '@shared/result'
import type { HistoryState } from '@shared/contracts/deck-builder'
import { HISTORY, chatItem, setupChat } from './testing'

const answered = chatItem({
  id: 'm1',
  role: 'assistant',
  text: 'Done! I added a plenary.',
  result: { changeSetId: 'cs1', label: '1 slide added', slideIds: ['s2'], undone: false }
})

const LATEST: HistoryState = { ...HISTORY, canUndo: true, undoChangeSetId: 'cs1' }
const UNDONE: HistoryState = { ...HISTORY, canRedo: true, redoChangeSetId: 'cs1' }

/** Like the editor: whatever the panel reports becomes the history it passes back in. */
function setupLikeEditor(options: Parameters<typeof setupChat>[0] = {}) {
  const onLessonChanged = vi.fn((change: { history: HistoryState }) =>
    t.rerender({ history: change.history })
  )
  const t = setupChat({ ...options, props: { ...options.props, onLessonChanged } })
  return t
}

describe('EditorChat result chip', () => {
  it('undoes the change through the contract and hands the editor the refreshed deck', async () => {
    const deck = { ...fixtureDeck(), title: 'Before' }
    const undo = vi.fn(() => ok({ deck, history: UNDONE }))
    const t = setupLikeEditor({
      deckBuilder: { undo },
      props: { initialChat: [answered], history: LATEST }
    })
    await t.user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(undo).toHaveBeenCalledWith({ lessonId: 'les_1' })
    expect(await screen.findByText('Undone')).toBeInTheDocument()
    expect(t.props.onLessonChanged).toHaveBeenCalledWith({ deck, history: UNDONE })
    expect(screen.getByRole('button', { name: 'Redo' })).toBeInTheDocument()
  })

  it('redoes it again from the same chip', async () => {
    const redo = vi.fn(() => ok({ deck: fixtureDeck(), history: LATEST }))
    const undone = chatItem({
      ...answered,
      result: { ...answered.result!, undone: true }
    })
    const t = setupLikeEditor({
      deckBuilder: { redo },
      props: { initialChat: [undone], history: UNDONE }
    })
    await t.user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(redo).toHaveBeenCalledWith({ lessonId: 'les_1' })
    expect(await screen.findByText('1 slide added')).toBeInTheDocument()
    expect(t.props.onLessonChanged).toHaveBeenCalledTimes(1)
  })

  it('disables Undo on an older change', () => {
    setupChat({
      props: { initialChat: [answered], history: { ...LATEST, undoChangeSetId: 'cs2' } }
    })
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('says so and keeps the chip when main cannot undo', async () => {
    const t = setupChat({
      deckBuilder: {
        undo: () => ({ ok: false, code: 'invalid-input', message: 'Nothing to undo.' })
      },
      props: { initialChat: [answered], history: LATEST }
    })
    await t.user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByText('Nothing to undo.')).toBeInTheDocument()
    expect(screen.getByText('1 slide added')).toBeInTheDocument()
    expect(t.props.onLessonChanged).not.toHaveBeenCalled()
  })

  it('flashes the affected slides while the chip is hovered', async () => {
    const t = setupChat({ props: { initialChat: [answered], history: LATEST } })
    await t.user.hover(screen.getByRole('button', { name: 'Undo' }))
    expect(t.props.onHighlightSlides).toHaveBeenLastCalledWith(['s2'])
    await t.user.unhover(screen.getByRole('button', { name: 'Undo' }))
    expect(t.props.onHighlightSlides).toHaveBeenLastCalledWith([])
  })

  it('selects the first affected slide when the pill is clicked', async () => {
    const onSelectSlide = vi.fn()
    const t = setupChat({ props: { initialChat: [answered], history: LATEST, onSelectSlide } })
    await t.user.click(screen.getByRole('button', { name: '1 slide added' }))
    expect(onSelectSlide).toHaveBeenCalledWith('s2')
  })
})
