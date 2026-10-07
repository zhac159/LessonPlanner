import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fail, ok } from '@shared/result'
import { makeChangeSet } from '@shared/deck/testing'
import { FakeLesson, LESSON, setupEditor, RUNNING_CHAT } from './testing'
import { resetStubs, seen } from './testStubs'

vi.mock('../chat', async () => (await import('./testStubs')).chatModule)
vi.mock('../circle', async () => (await import('./testStubs')).circleModule)

beforeEach(() => {
  resetStubs()
  window.localStorage.clear()
})

const ready = async () => {
  await screen.findByRole('navigation', { name: 'Slides' })
}

describe('EditorScreen: opening a lesson', () => {
  it('opens the lesson through the contract and shows the header, stage and filmstrip', async () => {
    const view = setupEditor()
    await ready()
    expect(view.db.openLesson).toHaveBeenCalledWith({ lessonId: LESSON })
    expect(screen.getByRole('textbox', { name: 'Lesson title' })).toHaveValue(
      'Y8 Science — Photosynthesis'
    )
    expect(screen.getByRole('button', { name: /My lessons/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Present' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export to PowerPoint' })).toBeInTheDocument()
    const slides = within(screen.getByRole('navigation', { name: 'Slides' }))
    expect(slides.getAllByRole('button', { name: /^Slide \d+(:|$)/ })).toHaveLength(3)
    expect(screen.getByLabelText('Chat stub')).toBeInTheDocument()
  })

  it('shows the first slide on the stage with Select as the active tool', async () => {
    setupEditor()
    await ready()
    expect(screen.getByRole('group', { name: 'Slide editing area' })).toBeInTheDocument()
    const first = screen.getByRole('button', { name: /^Slide 1/ })
    expect(first).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /^Select/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens on the slide she was last on in this lesson', async () => {
    window.localStorage.setItem(`slide-planner:last-slide:${LESSON}`, 's3')
    setupEditor()
    await ready()
    expect(screen.getByRole('button', { name: /^Slide 3(:|$)/ })).toHaveAttribute(
      'aria-current',
      'true'
    )
  })

  it('shows skeletons while the lesson loads', () => {
    setupEditor({ open: () => new Promise(() => {}) as never })
    expect(screen.getByRole('status', { name: 'Opening your lesson' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /My lessons/ })).toBeInTheDocument()
  })

  it('says the lesson could not be opened, with a way back', async () => {
    const view = setupEditor({ open: () => fail('invalid-input', 'damaged') })
    expect(await screen.findByText('This lesson couldn’t be opened.')).toBeInTheDocument()
    await view.user.click(screen.getByRole('button', { name: 'Back to Home' }))
    expect(view.props.onBack).toHaveBeenCalled()
  })

  it('treats a rejected open the same way', async () => {
    setupEditor({
      open: () => {
        throw new Error('boom')
      }
    })
    expect(await screen.findByText('This lesson couldn’t be opened.')).toBeInTheDocument()
  })

  it('goes back from the header', async () => {
    const view = setupEditor()
    await ready()
    await view.user.click(screen.getByRole('button', { name: /My lessons/ }))
    expect(view.props.onBack).toHaveBeenCalledTimes(1)
  })

  it('re-reads the lesson when the reload token changes', async () => {
    const view = setupEditor()
    await ready()
    view.rerenderEditor({ reloadToken: 1 })
    await waitFor(() => expect(view.db.openLesson).toHaveBeenCalledTimes(2))
  })
})

describe('EditorScreen: what the neighbours receive', () => {
  it('gives the chat the lesson, selection and (empty) regions', async () => {
    setupEditor({ view: { chat: [] } })
    await ready()
    expect(seen.chat?.lessonId).toBe(LESSON)
    expect(seen.chat?.deck.slides).toHaveLength(3)
    expect(seen.chat?.currentSlideId).toBe('s1')
    expect(seen.chat?.selectedSlideIds).toEqual(['s1'])
    expect(seen.chat?.regions).toEqual([])
    expect(seen.chat?.circleToolActive).toBe(false)
  })

  it('mounts the circle layer on the current slide, active only with the circle tool', async () => {
    const view = setupEditor()
    await ready()
    expect(seen.circle?.slide.id).toBe('s1')
    expect(seen.circle?.active).toBe(false)
    await view.user.click(screen.getByRole('button', { name: /^Circle to edit/ }))
    expect(seen.circle?.active).toBe(true)
    expect(seen.chat?.circleToolActive).toBe(true)
    expect(screen.getByText(/Circle it, then say what you want/)).toBeInTheDocument()
  })

  it('keeps the regions the layer adds, sends them to the chat, and removes them on request', async () => {
    const view = setupEditor()
    await ready()
    await view.user.click(screen.getByRole('button', { name: 'stub add region' }))
    expect(seen.chat?.regions).toHaveLength(1)
    expect(seen.circle?.regions).toHaveLength(1)
    seen.chat?.onRegionsChange([])
    await waitFor(() => expect(seen.chat?.regions).toEqual([]))
  })

  it('leaves the circle tool when the layer asks to', async () => {
    const view = setupEditor()
    await ready()
    await view.user.click(screen.getByRole('button', { name: /^Circle to edit/ }))
    await view.user.click(screen.getByRole('button', { name: 'stub exit circle' }))
    expect(seen.circle?.active).toBe(false)
    expect(screen.queryByText(/Circle it, then say what you want/)).not.toBeInTheDocument()
  })

  it('flags thumbnails of slides that carry a region', async () => {
    const view = setupEditor()
    await ready()
    await view.user.click(screen.getByRole('button', { name: 'stub add region' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Slide 1/ })).toHaveAttribute('data-mark-region')
    )
  })

  it('outlines slides a hovered result chip points at', async () => {
    const view = setupEditor()
    await ready()
    await view.user.click(screen.getByRole('button', { name: 'stub hover result' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Slide 2/ })).toHaveAttribute(
        'data-mark-highlight'
      )
    )
    await view.user.click(screen.getByRole('button', { name: 'stub unhover result' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Slide 2/ })).not.toHaveAttribute(
        'data-mark-highlight'
      )
    )
  })

  it('refreshes the deck and Undo/Redo when the chat reports a change', async () => {
    const lesson = new FakeLesson()
    const view = setupEditor({ lesson })
    await ready()
    const next = new FakeLesson(structuredClone(lesson.deck))
    next.deck.slides = next.deck.slides.slice(0, 2)
    next.summaries = ['Changed']
    next.past = [lesson.deck]
    seen.chat?.onLessonChanged({ deck: next.deck, history: next.history() })
    await waitFor(() =>
      expect(
        within(screen.getByRole('navigation', { name: 'Slides' })).getAllByRole('button', {
          name: /^Slide \d+(:|$)/
        })
      ).toHaveLength(2)
    )
    expect(screen.getByRole('button', { name: /^Undo/ })).toBeEnabled()
    expect(view.db.openLesson).toHaveBeenCalledTimes(1)
  })
})

describe('EditorScreen: empty and busy lessons', () => {
  const emptyLesson = (): FakeLesson => {
    const lesson = new FakeLesson()
    lesson.deck = { ...lesson.deck, slides: [] }
    return lesson
  }

  it('shows the empty state with Present and Export waiting', async () => {
    setupEditor({ lesson: emptyLesson() })
    expect(await screen.findByText('Your slides will appear here')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Present' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Export to PowerPoint' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  it('adds a blank slide from the empty state', async () => {
    const lesson = emptyLesson()
    const view = setupEditor({ lesson })
    await view.user.click(await screen.findByRole('button', { name: 'Blank slide' }))
    await waitFor(() => expect(lesson.deck.slides).toHaveLength(1))
    expect(await screen.findByRole('button', { name: /^Slide 1/ })).toBeInTheDocument()
  })

  it('is view-only while a chat job runs: Present, Export and tools wait, the style chip is off', async () => {
    setupEditor({
      view: {
        runningJob: RUNNING_CHAT
      }
    })
    await ready()
    expect(screen.getByRole('button', { name: 'Present' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Present' })).toHaveAttribute(
      'title',
      'Wait until your slides are ready'
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Circle to edit/ })).toHaveAttribute(
        'aria-disabled',
        'true'
      )
    )
    expect(screen.getByRole('textbox', { name: 'Lesson title' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Add slide' })).not.toBeInTheDocument()
  })

  it('tells the teacher when someone else edits: a chat:changes event refreshes the deck', async () => {
    const lesson = new FakeLesson()
    const view = setupEditor({ lesson })
    await ready()
    lesson.applyOps({
      ops: [{ op: 'deleteSlides', slideIds: ['s3'] }],
      summary: 'Removed'
    })
    view.emit('chat:changes', {
      lessonId: LESSON,
      changeSet: makeChangeSet([{ op: 'deleteSlides', slideIds: ['s3'] }])
    } as never)
    await waitFor(() =>
      expect(
        within(screen.getByRole('navigation', { name: 'Slides' })).getAllByRole('button', {
          name: /^Slide \d+(:|$)/
        })
      ).toHaveLength(2)
    )
  })

  it('keeps working when the re-read after a change fails', async () => {
    let calls = 0
    const lesson = new FakeLesson()
    const view = setupEditor({
      lesson,
      open: () => (++calls === 1 ? ok(lesson.view()) : fail('invalid-input', 'nope'))
    })
    await ready()
    view.emit('chat:changes', { lessonId: LESSON, changeSet: makeChangeSet([]) } as never)
    await waitFor(() => expect(calls).toBe(2))
    expect(screen.getByRole('navigation', { name: 'Slides' })).toBeInTheDocument()
  })
})
