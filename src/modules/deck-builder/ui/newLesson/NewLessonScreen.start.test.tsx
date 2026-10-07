import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fail, ok } from '@shared/result'
import { COPY_FAILED } from './hooks/usePastLessons'
import { composer, lesson, plugin, renderScreen, style } from './testing'

describe('NewLessonScreen: Blank slide', () => {
  it('creates a lesson with one blank slide and opens it', async () => {
    const { user, deckBuilder, onOpenLesson } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Blank slide' }))
    await waitFor(() => expect(onOpenLesson).toHaveBeenCalledWith('les_new'))
    expect(deckBuilder.createLesson).toHaveBeenCalledWith({
      objectivesText: '',
      documentIds: [],
      styleId: 'sty_science',
      title: null,
      meta: { durationMin: 50, ability: 'Mixed ability', targetSlideCount: 8 },
      startGeneration: false,
      blankSlide: true
    })
  })

  it('says so when the lesson could not be made', async () => {
    const { user, onOpenLesson } = renderScreen({
      deckBuilder: { createLesson: () => fail('io', 'I couldn’t save your lesson.') }
    })
    await user.click(screen.getByRole('button', { name: 'Blank slide' }))
    expect(await screen.findByText('I couldn’t save your lesson.')).toBeInTheDocument()
    expect(onOpenLesson).not.toHaveBeenCalled()
  })
})

describe('NewLessonScreen: Start from a past lesson', () => {
  const lessons = [
    lesson(),
    lesson({ id: 'les_2', title: 'Y9 Chemistry — Acids', yearShort: 'Year 9', slideCount: 12 }),
    lesson({ id: 'les_3', title: 'Broken lesson', damaged: true })
  ]

  it('lists past lessons in a dialog and opens a copy of the one she picks', async () => {
    const duplicateLesson = vi.fn(() => ok({ lesson: lesson({ id: 'les_copy' }) }))
    const { user, onOpenLesson } = renderScreen({
      deckBuilder: { listLessons: () => lessons, duplicateLesson }
    })
    await user.click(screen.getByRole('button', { name: 'Start from a past lesson' }))
    const dialog = await screen.findByRole('dialog', { name: 'Start from a past lesson' })
    expect(await within(dialog).findByText('Y8 Science — Cells')).toBeInTheDocument()
    expect(within(dialog).queryByText('Broken lesson')).not.toBeInTheDocument()
    const use = within(dialog).getByRole('button', { name: 'Use this lesson' })
    expect(use).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: /Y9 Chemistry — Acids/ }))
    expect(use).toBeEnabled()
    await user.click(use)
    await waitFor(() => expect(onOpenLesson).toHaveBeenCalledWith('les_copy'))
    expect(duplicateLesson).toHaveBeenCalledWith({ lessonId: 'les_2' })
  })

  it('opens a copy on double-click and on Enter', async () => {
    const duplicateLesson = vi.fn(() => ok({ lesson: lesson({ id: 'les_copy' }) }))
    const { user } = renderScreen({ deckBuilder: { listLessons: () => lessons, duplicateLesson } })
    await user.click(screen.getByRole('button', { name: 'Start from a past lesson' }))
    const card = await screen.findByRole('button', { name: /Y8 Science — Cells/ })
    await user.dblClick(card)
    await waitFor(() => expect(duplicateLesson).toHaveBeenCalledWith({ lessonId: 'les_1' }))
    duplicateLesson.mockClear()
    card.focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(duplicateLesson).toHaveBeenCalledWith({ lessonId: 'les_1' }))
  })

  it('closes with Cancel or Esc and leaves the empty lesson alone', async () => {
    const { user, deckBuilder } = renderScreen({ deckBuilder: { listLessons: () => lessons } })
    await user.click(screen.getByRole('button', { name: 'Start from a past lesson' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start from a past lesson' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deckBuilder.createLesson).not.toHaveBeenCalled()
    expect(deckBuilder.duplicateLesson).not.toHaveBeenCalled()
  })

  it('explains a failed copy and stays open', async () => {
    const { user, onOpenLesson } = renderScreen({
      deckBuilder: {
        listLessons: () => lessons,
        duplicateLesson: () => {
          throw new Error('disk full')
        }
      }
    })
    await user.click(screen.getByRole('button', { name: 'Start from a past lesson' }))
    await user.dblClick(await screen.findByRole('button', { name: /Y8 Science — Cells/ }))
    expect(await screen.findByText(COPY_FAILED)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onOpenLesson).not.toHaveBeenCalled()
  })
})

describe('NewLessonScreen: style chip', () => {
  const styles = [
    style({ id: 'sty_art', name: 'Art', isDefault: false }),
    style(),
    style({ id: 'sty_draft', name: 'Half done', isDefault: false, status: 'draft' })
  ]

  it('starts on the default style and offers the others and “Create a new style…”', async () => {
    const { user } = renderScreen({ library: { list: () => styles } })
    const chip = await screen.findByRole('button', { name: /^Your style: Science KS3/ })
    await user.click(chip)
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['Science KS3', 'Art', 'Create a new style…'])
  })

  it('changes the style sent with the lesson and the panel subtitle', async () => {
    const { user, deckBuilder } = renderScreen({ library: { list: () => styles } })
    await user.click(await screen.findByRole('button', { name: /^Your style: Science KS3/ }))
    await user.click(screen.getByRole('option', { name: 'Art' }))
    expect(screen.getByText('Knows your Art style')).toBeInTheDocument()
    await user.type(composer(), 'LO1')
    await user.click(screen.getByRole('button', { name: 'Make my slides' }))
    await waitFor(() =>
      expect(deckBuilder.createLesson).toHaveBeenCalledWith(
        expect.objectContaining({ styleId: 'sty_art' })
      )
    )
  })

  it('goes to the style builder for “Create a new style…”', async () => {
    const { user, shell } = renderScreen({ library: { list: () => styles } })
    await user.click(await screen.findByRole('button', { name: /^Your style: Science KS3/ }))
    await user.click(screen.getByRole('option', { name: 'Create a new style…' }))
    expect(shell.navigate).toHaveBeenCalledWith('style-library', { kind: 'new-style' })
  })

  it('sends no style for the plain style', async () => {
    const { user, deckBuilder } = renderScreen({ library: { list: () => [] } })
    await user.type(composer(), 'LO1')
    await user.click(screen.getByRole('button', { name: 'Make my slides' }))
    await waitFor(() =>
      expect(deckBuilder.createLesson).toHaveBeenCalledWith(
        expect.objectContaining({ styleId: null })
      )
    )
  })
})

describe('NewLessonScreen: the + menu', () => {
  it('opens with every plugin unavailable until there are slides', async () => {
    const { user, shell } = renderScreen({
      deckBuilder: {
        'plugins:list': () => [plugin(), plugin({ id: 'notes', name: 'Speaker notes' })]
      }
    })
    const plus = screen.getByRole('button', { name: 'Plugins' })
    await screen.findByRole('button', { name: /^Your style/ })
    await user.click(plus)
    expect(plus).toHaveAttribute('aria-expanded', 'true')
    const menu = await screen.findByRole('menu')
    const quiz = await within(menu).findByRole('menuitem', { name: /Quiz/ })
    expect(quiz).toHaveAttribute('aria-disabled', 'true')
    expect(within(menu).getByRole('menuitem', { name: /Speaker notes/ })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    await user.click(quiz)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.click(within(menu).getByRole('menuitem', { name: 'Manage' }))
    expect(shell.navigate).toHaveBeenCalledWith('plugins')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('closes on Esc and gives focus back to +', async () => {
    const { user } = renderScreen()
    const plus = screen.getByRole('button', { name: 'Plugins' })
    await user.click(plus)
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(plus).toHaveFocus()
  })
})
