import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StyleSummary } from '@shared/contracts/style-library'
import { ok } from '@shared/result'
import { FakeLesson, setupEditor, RUNNING_CHAT } from './testing'
import { resetStubs, seen } from './testStubs'

vi.mock('../chat', async () => (await import('./testStubs')).chatModule)
vi.mock('../circle', async () => (await import('./testStubs')).circleModule)

beforeEach(() => {
  resetStubs()
  window.localStorage.clear()
})

const open = async (options = {}) => {
  const view = setupEditor(options)
  await screen.findByRole('navigation', { name: 'Slides' })
  return view
}
const titleBox = () => screen.getByRole('textbox', { name: 'Lesson title' })
const toasts = () => within(screen.getByRole('region', { name: 'Notifications' }))

describe('renaming the lesson', () => {
  it('Enter saves the new title through renameLesson and re-reads the lesson', async () => {
    const view = await open()
    await view.user.clear(titleBox())
    await view.user.type(titleBox(), 'Plants and light{Enter}')
    await waitFor(() =>
      expect(view.db.renameLesson).toHaveBeenCalledWith({
        lessonId: 'les_1',
        title: 'Plants and light'
      })
    )
    await waitFor(() => expect(view.db.openLesson).toHaveBeenCalledTimes(2))
    expect(titleBox()).toHaveValue('Plants and light')
  })

  it('saves on blur too', async () => {
    const view = await open()
    await view.user.clear(titleBox())
    await view.user.type(titleBox(), 'Another')
    await view.user.tab()
    await waitFor(() => expect(view.db.renameLesson).toHaveBeenCalledTimes(1))
  })

  it('Esc goes back to the old title and saves nothing', async () => {
    const view = await open()
    await view.user.type(titleBox(), ' extra{Escape}')
    expect(titleBox()).toHaveValue('Y8 Science — Photosynthesis')
    expect(view.db.renameLesson).not.toHaveBeenCalled()
  })

  it('an empty title restores the old one', async () => {
    const view = await open()
    await view.user.clear(titleBox())
    await view.user.tab()
    expect(titleBox()).toHaveValue('Y8 Science — Photosynthesis')
    expect(view.db.renameLesson).not.toHaveBeenCalled()
  })

  it('stops at 80 characters', async () => {
    await open()
    expect(titleBox()).toHaveAttribute('maxlength', '80')
  })
})

describe('Undo and Redo', () => {
  const edit = async (view: Awaited<ReturnType<typeof open>>) => {
    await view.user.click(screen.getByRole('button', { name: /^Slide 2/ }))
    await view.user.click(screen.getByRole('button', { name: 'Add slide' }))
    await waitFor(() => expect(view.lesson.deck.slides).toHaveLength(4))
  }

  it('are off when there is nothing to undo or redo', async () => {
    await open()
    expect(screen.getByRole('button', { name: /^Undo/ })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: /^Redo/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('describe what they would change, from the history summary', async () => {
    const view = await open()
    await edit(view)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Undo/ })).toHaveAttribute(
        'aria-description',
        'Undoes: Added a slide'
      )
    )
  })

  it('Undo goes back one step, Redo forward again', async () => {
    const view = await open()
    await edit(view)
    await view.user.click(screen.getByRole('button', { name: /^Undo/ }))
    await waitFor(() => expect(view.lesson.deck.slides).toHaveLength(3))
    await waitFor(() =>
      expect(
        within(screen.getByRole('navigation', { name: 'Slides' })).getAllByRole('button', {
          name: /^Slide \d+(:|$)/
        })
      ).toHaveLength(3)
    )
    expect(screen.getByRole('button', { name: /^Redo/ })).not.toHaveAttribute('aria-disabled')
    await view.user.click(screen.getByRole('button', { name: /^Redo/ }))
    await waitFor(() =>
      expect(
        within(screen.getByRole('navigation', { name: 'Slides' })).getAllByRole('button', {
          name: /^Slide \d+(:|$)/
        })
      ).toHaveLength(4)
    )
  })

  it('Ctrl+Z and Ctrl+Y work from the keyboard', async () => {
    const view = await open()
    await edit(view)
    await view.user.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(view.db.undo).toHaveBeenCalledTimes(1))
    await view.user.keyboard('{Control>}y{/Control}')
    await waitFor(() => expect(view.db.redo).toHaveBeenCalledTimes(1))
  })

  it('Ctrl+Z inside a text field is the field’s own undo', async () => {
    const view = await open()
    await edit(view)
    await view.user.click(titleBox())
    await view.user.keyboard('{Control>}z{/Control}')
    expect(view.db.undo).not.toHaveBeenCalled()
  })

  it('shows a refusal in a toast and leaves the deck alone', async () => {
    const lesson = new FakeLesson()
    const view = await open({
      lesson,
      deckBuilder: {
        undo: () => ({ ok: false, code: 'invalid-input', message: 'Nothing to undo' })
      }
    })
    seen.chat?.onLessonChanged({
      deck: lesson.deck,
      history: { ...lesson.history(), canUndo: true }
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Undo/ })).not.toHaveAttribute('aria-disabled')
    )
    await view.user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(await toasts().findByText('Nothing to undo')).toBeInTheDocument()
  })
})

describe('Export to PowerPoint', () => {
  it('shows "Exporting…" while the dialog is open, and says nothing when she cancels', async () => {
    let finish: (value: { status: 'cancelled' }) => void = () => {}
    const view = await open({
      deckBuilder: { exportPptx: () => new Promise((resolve) => (finish = resolve)) as never }
    })
    await view.user.click(screen.getByRole('button', { name: 'Export to PowerPoint' }))
    expect(await screen.findByRole('button', { name: /Exporting…/ })).toBeInTheDocument()
    finish({ status: 'cancelled' })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Export to PowerPoint' })).toBeInTheDocument()
    )
    expect(screen.queryByText(/^Saved/)).not.toBeInTheDocument()
  })

  it('toasts the saved file with Open in PowerPoint, which opens it', async () => {
    const view = await open({
      deckBuilder: {
        exportPptx: () => ({
          status: 'saved',
          path: 'C:/docs/Lesson.pptx',
          fileName: 'Lesson.pptx',
          missingFonts: []
        })
      }
    })
    await view.user.click(screen.getByRole('button', { name: 'Export to PowerPoint' }))
    expect(await toasts().findByText('Saved Lesson.pptx')).toBeInTheDocument()
    await view.user.click(toasts().getByRole('button', { name: 'Open in PowerPoint' }))
    expect(view.db.openExport).toHaveBeenCalledWith({ path: 'C:/docs/Lesson.pptx' })
  })

  it('adds the missing-font line to the toast', async () => {
    const view = await open({
      deckBuilder: {
        exportPptx: () => ({
          status: 'saved',
          path: 'C:/x.pptx',
          fileName: 'x.pptx',
          missingFonts: ['Lexend']
        })
      }
    })
    await view.user.click(screen.getByRole('button', { name: 'Export to PowerPoint' }))
    expect(await toasts().findByText(/Lexend isn’t installed on this PC/)).toBeInTheDocument()
  })

  it('tells her when the file is locked, and when the call fails', async () => {
    const view = await open({
      deckBuilder: {
        exportPptx: () => ({ status: 'error', code: 'file-locked', message: '' })
      }
    })
    await view.user.click(screen.getByRole('button', { name: 'Export to PowerPoint' }))
    expect(
      await toasts().findByText('Close the file in PowerPoint, then try again.')
    ).toBeInTheDocument()
  })

  it('reports a thrown failure with the generic copy', async () => {
    const view = await open({
      deckBuilder: {
        exportPptx: () => {
          throw new Error('x')
        }
      }
    })
    await view.user.click(screen.getByRole('button', { name: 'Export to PowerPoint' }))
    expect(
      await toasts().findByText('Couldn’t save the file. Try another folder.')
    ).toBeInTheDocument()
  })

  it('Ctrl+E exports', async () => {
    const view = await open()
    await view.user.keyboard('{Control>}e{/Control}')
    await waitFor(() => expect(view.db.exportPptx).toHaveBeenCalledWith({ lessonId: 'les_1' }))
  })

  it('does not start while an AI job runs', async () => {
    const view = await open({
      view: {
        runningJob: RUNNING_CHAT
      }
    })
    await view.user.click(screen.getByRole('button', { name: 'Export to PowerPoint' }))
    await view.user.keyboard('{Control>}e{/Control}')
    expect(view.db.exportPptx).not.toHaveBeenCalled()
  })

  it('does not listen when the module is not the visible one', async () => {
    const view = await open({ props: { active: false } })
    await view.user.keyboard('{Control>}e{/Control}')
    expect(view.db.exportPptx).not.toHaveBeenCalled()
  })
})

describe('the style chip', () => {
  const styles = [
    { id: 'sty_science_ks3', name: 'Science KS3', isDefault: true, status: 'ready' },
    { id: 'sty_art', name: 'Art', isDefault: false, status: 'ready' },
    { id: 'sty_draft', name: 'Draft one', isDefault: false, status: 'draft' }
  ].map((s) => ({ primaryHex: '#0A7', tintHex: '#EFE', ...s }) as unknown as StyleSummary)

  it('is not shown without styles', async () => {
    await open()
    expect(screen.queryByRole('button', { name: /Your style/ })).not.toBeInTheDocument()
  })

  it('offers her finished styles, asks before restyling and sends one chat turn', async () => {
    const chat = vi.fn(async () => ok({ jobId: 'j1' }))
    const view = await open({ styles, deckBuilder: { 'chat:send': chat as never } })
    await view.user.click(await screen.findByRole('button', { name: /Your style/ }))
    expect(screen.queryByRole('option', { name: /Draft one/ })).not.toBeInTheDocument()
    await view.user.click(await screen.findByRole('option', { name: /Art/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Restyle this lesson?' })
    expect(within(dialog).getByText(/All 3 slides will be redrawn in Art/)).toBeInTheDocument()
    await view.user.click(within(dialog).getByRole('button', { name: 'Restyle' }))
    await waitFor(() => expect(chat).toHaveBeenCalledTimes(1))
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({ lessonId: 'les_1', selectedSlideId: 's1', regions: [] })
    )
  })

  it('does nothing when she cancels the question', async () => {
    const chat = vi.fn(async () => ok({ jobId: 'j1' }))
    const view = await open({ styles, deckBuilder: { 'chat:send': chat as never } })
    await view.user.click(await screen.findByRole('button', { name: /Your style/ }))
    await view.user.click(await screen.findByRole('option', { name: /Art/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Restyle this lesson?' })
    await view.user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(chat).not.toHaveBeenCalled()
  })
})
