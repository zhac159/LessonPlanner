import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fail, ok } from '@shared/result'
import { lesson } from './testSupport'
import { renderHome } from './renderHome'

const LESSONS = [
  lesson({ id: 'a', title: 'Photosynthesis', updatedAt: '2026-10-06T08:00:00' }),
  lesson({
    id: 'b',
    title: 'Cells and organelles',
    yearGroup: 'Year 7',
    yearShort: 'Year 7',
    updatedAt: '2026-10-05T08:00:00'
  })
]

async function openMenu(user: ReturnType<typeof renderHome>['user'], title = 'Photosynthesis') {
  await user.click(await screen.findByRole('button', { name: `More actions for ${title}` }))
  return screen.getByRole('menu', { name: 'Lesson actions' })
}

const titles = () =>
  within(screen.getByRole('list', { name: 'Past lessons' }))
    .getAllByRole('listitem')
    .map((item) => {
      const button = within(item).getAllByRole('button')[0]
      return document.getElementById(button.getAttribute('aria-labelledby') ?? '')?.textContent
    })

describe('HomeView lesson menu', () => {
  it('opens from ⋯ with the five actions, Delete in the danger style', async () => {
    const { user } = renderHome({ lessons: LESSONS })
    const menu = await openMenu(user)
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((i) => i.textContent)
    ).toEqual(['Open', 'Duplicate', 'Rename…', 'Export to PowerPoint', 'Delete…'])
  })

  it('opens from a right-click and from Shift+F10 on a focused card', async () => {
    const { user } = renderHome({ lessons: LESSONS })
    const card = await screen.findByRole('button', { name: 'Photosynthesis' })
    fireEvent.contextMenu(card, { clientX: 40, clientY: 50 })
    expect(screen.getByRole('menu', { name: 'Lesson actions' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.contextMenu(card, { clientX: 0, clientY: 0 })
    expect(screen.getByRole('menu', { name: 'Lesson actions' })).toBeInTheDocument()
  })

  it('Open goes to the editor', async () => {
    const { user, shell } = renderHome({ lessons: LESSONS })
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Open' }))
    expect(shell.navigate).toHaveBeenCalledWith('deck-builder', {
      kind: 'open-lesson',
      lessonId: 'a'
    })
  })

  it('disables Duplicate, Rename and Export while the lesson is still being made', async () => {
    const { user } = renderHome({
      lessons: [lesson({ id: 'g', title: 'Fresh', status: 'generating' })]
    })
    const menu = await openMenu(user, 'Fresh')
    expect(within(menu).getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(within(menu).getByRole('menuitem', { name: 'Rename…' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(within(menu).getByRole('menuitem', { name: 'Export to PowerPoint' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(within(menu).getByRole('menuitem', { name: 'Open' })).not.toHaveAttribute(
      'aria-disabled'
    )
    expect(within(menu).getByRole('menuitem', { name: 'Delete…' })).not.toHaveAttribute(
      'aria-disabled'
    )
  })
})

describe('HomeView duplicate', () => {
  it('puts the copy first and confirms with a toast', async () => {
    const copy = lesson({
      id: 'c',
      title: 'Photosynthesis (copy)',
      updatedAt: '2026-10-06T09:00:00'
    })
    const duplicate = vi.fn(() => ok({ lesson: copy }))
    const { user } = renderHome({ lessons: LESSONS, deckBuilder: { duplicateLesson: duplicate } })
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Duplicate' }))
    expect(duplicate).toHaveBeenCalledWith({ lessonId: 'a' })
    expect(await screen.findByText('Duplicated “Photosynthesis”')).toBeInTheDocument()
    expect(titles()[0]).toBe('Photosynthesis (copy)')
  })

  it('says so when it fails', async () => {
    const duplicate = vi.fn(() => fail('io', 'Not enough space.'))
    const { user } = renderHome({ lessons: LESSONS, deckBuilder: { duplicateLesson: duplicate } })
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Duplicate' }))
    expect(await screen.findByText('Not enough space.')).toBeInTheDocument()
    expect(titles()).toHaveLength(2)
  })
})

describe('HomeView rename', () => {
  it('renames through the dialog and updates the card', async () => {
    const rename = vi.fn(({ title }: { title: string }) =>
      ok({ lesson: lesson({ id: 'a', title }) })
    )
    const { user } = renderHome({ lessons: LESSONS, deckBuilder: { renameLesson: rename } })
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Rename…' }))
    const field = await screen.findByRole('textbox', { name: 'Lesson title' })
    expect(field).toHaveValue('Photosynthesis')
    await user.clear(field)
    await user.type(field, 'Plant energy{Enter}')
    expect(rename).toHaveBeenCalledWith({ lessonId: 'a', title: 'Plant energy' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(titles()).toContain('Plant energy')
  })

  it('cancels with Esc and changes nothing', async () => {
    const rename = vi.fn()
    const { user } = renderHome({ lessons: LESSONS, deckBuilder: { renameLesson: rename } })
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Rename…' }))
    await screen.findByRole('dialog', { name: 'Rename lesson' })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(rename).not.toHaveBeenCalled()
  })

  it('keeps the dialog open and explains when saving fails', async () => {
    const rename = vi.fn(() => fail('io', 'Couldn’t save that.'))
    const { user } = renderHome({ lessons: LESSONS, deckBuilder: { renameLesson: rename } })
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Rename…' }))
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Couldn’t save that.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Rename lesson' })).toBeInTheDocument()
  })
})

describe('HomeView export', () => {
  it('toasts the saved file with an Open in PowerPoint action', async () => {
    const exportPptx = vi.fn(() => ({
      status: 'saved' as const,
      path: 'C:/out/Photosynthesis.pptx',
      fileName: 'Photosynthesis.pptx',
      missingFonts: []
    }))
    const openExport = vi.fn(() => ok())
    const { user } = renderHome({ lessons: LESSONS, deckBuilder: { exportPptx, openExport } })
    await user.click(
      within(await openMenu(user)).getByRole('menuitem', { name: 'Export to PowerPoint' })
    )
    expect(exportPptx).toHaveBeenCalledWith({ lessonId: 'a' })
    expect(await screen.findByText('Saved Photosynthesis.pptx')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open in PowerPoint' }))
    expect(openExport).toHaveBeenCalledWith({ path: 'C:/out/Photosynthesis.pptx' })
  })

  it('stays quiet when the Save dialog is cancelled', async () => {
    const exportPptx = vi.fn(() => ({ status: 'cancelled' as const }))
    const { user } = renderHome({ lessons: LESSONS, deckBuilder: { exportPptx } })
    await user.click(
      within(await openMenu(user)).getByRole('menuitem', { name: 'Export to PowerPoint' })
    )
    await waitFor(() => expect(exportPptx).toHaveBeenCalled())
    expect(screen.queryByRole('status')).not.toHaveTextContent(/Saved/)
  })

  it('reports an export error', async () => {
    const exportPptx = vi.fn(() => ({
      status: 'error' as const,
      code: 'file-locked' as const,
      message: 'That file is open in PowerPoint.'
    }))
    const { user } = renderHome({ lessons: LESSONS, deckBuilder: { exportPptx } })
    await user.click(
      within(await openMenu(user)).getByRole('menuitem', { name: 'Export to PowerPoint' })
    )
    expect(await screen.findByText('That file is open in PowerPoint.')).toBeInTheDocument()
  })
})

describe('HomeView export with empty picture spots', () => {
  const spotsAnswer = { status: 'spots' as const, count: 3, slides: [2, 4] }
  const saved = {
    status: 'saved' as const,
    path: 'C:/out/P.pptx',
    fileName: 'P.pptx',
    missingFonts: []
  }
  const exportItem = async (user: ReturnType<typeof renderHome>['user']) =>
    user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Export to PowerPoint' }))

  it('asks first, then Export anyway exports again ignoring the spots', async () => {
    const exportPptx = vi.fn((args: { ignoreSpots?: boolean }) =>
      args.ignoreSpots ? saved : spotsAnswer
    )
    const { user } = renderHome({ lessons: LESSONS, deckBuilder: { exportPptx } })
    await exportItem(user)
    const dialog = await screen.findByRole('dialog', {
      name: '3 picture spots are empty and will be skipped'
    })
    expect(exportPptx).toHaveBeenCalledTimes(1)
    expect(exportPptx).toHaveBeenLastCalledWith({ lessonId: 'a' })
    await user.click(within(dialog).getByRole('button', { name: 'Export anyway' }))
    expect(await screen.findByText('Saved P.pptx')).toBeInTheDocument()
    expect(exportPptx).toHaveBeenLastCalledWith({ lessonId: 'a', ignoreSpots: true })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Open lesson goes to the editor without exporting', async () => {
    const exportPptx = vi.fn(() => spotsAnswer)
    const { user, shell } = renderHome({ lessons: LESSONS, deckBuilder: { exportPptx } })
    await exportItem(user)
    await user.click(await screen.findByRole('button', { name: 'Open lesson' }))
    expect(shell.navigate).toHaveBeenCalledWith('deck-builder', {
      kind: 'open-lesson',
      lessonId: 'a'
    })
    expect(exportPptx).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Esc closes the question and exports nothing', async () => {
    const exportPptx = vi.fn(() => spotsAnswer)
    const { user } = renderHome({ lessons: LESSONS, deckBuilder: { exportPptx } })
    await exportItem(user)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(exportPptx).toHaveBeenCalledTimes(1)
  })
})

describe('HomeView delete', () => {
  it('asks first, and Cancel keeps the lesson', async () => {
    const del = vi.fn(() => ok())
    const { user } = renderHome({ lessons: LESSONS, deckBuilder: { deleteLesson: del } })
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Delete…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete this lesson?' })
    expect(dialog).toHaveTextContent('“Photosynthesis” will move to the Recycle Bin.')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(del).not.toHaveBeenCalled()
    expect(titles()).toHaveLength(2)
  })

  it('deletes after confirming, removes the card and offers Undo', async () => {
    const del = vi.fn(() => ok())
    const restore = vi.fn(() => ok())
    const { user, deckBuilder } = renderHome({
      lessons: LESSONS,
      deckBuilder: { deleteLesson: del, restoreLesson: restore }
    })
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Delete…' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete this lesson?' })).getByRole(
        'button',
        { name: 'Delete' }
      )
    )
    expect(del).toHaveBeenCalledWith({ lessonId: 'a' })
    expect(await screen.findByText('Lesson deleted')).toBeInTheDocument()
    expect(titles()).toEqual(['Cells and organelles'])
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(restore).toHaveBeenCalledWith({ lessonId: 'a' })
    await waitFor(() => expect(deckBuilder.listLessons).toHaveBeenCalledTimes(2))
  })

  it('opens the same confirmation from the Delete key on a focused card', async () => {
    renderHome({ lessons: LESSONS })
    const card = await screen.findByRole('button', { name: 'Cells and organelles' })
    card.focus()
    fireEvent.keyDown(card, { key: 'Delete' })
    expect(await screen.findByRole('dialog', { name: 'Delete this lesson?' })).toHaveTextContent(
      '“Cells and organelles”'
    )
  })

  it('keeps the card and says so when deleting fails', async () => {
    const del = vi.fn(() => fail('io', 'The Recycle Bin is not available.'))
    const { user } = renderHome({ lessons: LESSONS, deckBuilder: { deleteLesson: del } })
    await user.click(within(await openMenu(user)).getByRole('menuitem', { name: 'Delete…' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete this lesson?' })).getByRole(
        'button',
        { name: 'Delete' }
      )
    )
    expect(await screen.findByText('The Recycle Bin is not available.')).toBeInTheDocument()
    expect(titles()).toHaveLength(2)
  })

  it('can delete a damaged lesson from its card', async () => {
    const del = vi.fn(() => ok())
    const { user } = renderHome({
      lessons: [lesson({ id: 'x', title: 'Broken', damaged: true })],
      deckBuilder: { deleteLesson: del }
    })
    await user.click(await screen.findByRole('button', { name: 'Delete…' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete this lesson?' })).getByRole(
        'button',
        { name: 'Delete' }
      )
    )
    expect(del).toHaveBeenCalledWith({ lessonId: 'x' })
  })
})
