import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupEditor } from './testing'
import { resetStubs } from './testStubs'

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
const layer = () => document.querySelector('.element-layer') as HTMLElement
const note = { id: 'n1', slideId: 's1', x: 100, y: 100, text: 'Hand out the sheets' }

describe('sticky notes', () => {
  it('shows the notes of the slide on the stage only', async () => {
    const view = await open({
      view: { stickyNotes: [note, { ...note, id: 'n2', slideId: 's2', text: 'Other slide' }] }
    })
    expect(screen.getByDisplayValue('Hand out the sheets')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Other slide')).not.toBeInTheDocument()
    await view.user.click(screen.getByRole('button', { name: /^Slide 2/ }))
    expect(screen.getByDisplayValue('Other slide')).toBeInTheDocument()
  })

  it('the Sticky note tool places a note, focuses it and returns to Select', async () => {
    const view = await open()
    await view.user.click(screen.getByRole('button', { name: 'Sticky note' }))
    fireEvent.pointerDown(layer())
    const field = await screen.findByRole('textbox', { name: 'Sticky note' })
    await waitFor(() => expect(field).toHaveFocus())
    expect(field).toHaveAttribute('placeholder', 'Note to self…')
    expect(screen.getByRole('button', { name: /^Select/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('saves the note with the lesson when she leaves it, and never as a deck change', async () => {
    const view = await open()
    await view.user.click(screen.getByRole('button', { name: 'Sticky note' }))
    fireEvent.pointerDown(layer())
    const field = await screen.findByRole('textbox', { name: 'Sticky note' })
    await view.user.type(field, 'Check the projector')
    await view.user.keyboard('{Escape}')
    await waitFor(() => expect(view.db.setStickyNotes).toHaveBeenCalledTimes(1))
    expect(view.db.setStickyNotes.mock.calls[0][0]).toMatchObject({
      lessonId: 'les_1',
      notes: [{ slideId: 's1', text: 'Check the projector' }]
    })
    expect(view.db.applyOps).not.toHaveBeenCalled()
  })

  it('removes a note that was left empty', async () => {
    const view = await open()
    await view.user.click(screen.getByRole('button', { name: 'Sticky note' }))
    fireEvent.pointerDown(layer())
    await screen.findByRole('textbox', { name: 'Sticky note' })
    await view.user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Sticky note' })).not.toBeInTheDocument()
    )
  })

  it('deletes a note with its × button', async () => {
    const view = await open({ view: { stickyNotes: [note] } })
    await view.user.click(screen.getByRole('button', { name: 'Delete note' }))
    expect(screen.queryByDisplayValue('Hand out the sheets')).not.toBeInTheDocument()
    expect(view.db.setStickyNotes).toHaveBeenCalledWith({ lessonId: 'les_1', notes: [] })
  })

  it('keeps the note on screen when saving fails', async () => {
    const view = await open({
      view: { stickyNotes: [note] },
      deckBuilder: {
        setStickyNotes: () => {
          throw new Error('disk')
        }
      }
    })
    await view.user.type(screen.getByDisplayValue('Hand out the sheets'), '!')
    await view.user.tab()
    await waitFor(() => expect(view.db.setStickyNotes).toHaveBeenCalled())
    expect(screen.getByDisplayValue('Hand out the sheets!')).toBeInTheDocument()
  })

  it('does not place notes while the stage is view-only', async () => {
    const view = await open()
    await view.user.click(screen.getByRole('button', { name: 'Sticky note' }))
    view.emit('chat:status', { lessonId: 'les_1', state: 'running' } as never)
    await waitFor(() => expect(layer()).toHaveAttribute('data-tool', 'select'))
    fireEvent.pointerDown(layer())
    expect(screen.queryByRole('textbox', { name: 'Sticky note' })).not.toBeInTheDocument()
  })
})
