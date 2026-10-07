import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSlide, makeText } from '@shared/deck/testing'
import { fail } from '@shared/result'
import { FakeLesson, LESSON, RUNNING_CHAT, RUNNING_GENERATION, setupEditor } from './testing'
import { resetStubs } from './testStubs'

vi.mock('../chat', async () => (await import('./testStubs')).chatModule)
vi.mock('../circle', async () => (await import('./testStubs')).circleModule)

beforeEach(() => {
  resetStubs()
  window.localStorage.clear()
})

const emptyLesson = (): FakeLesson => {
  const lesson = new FakeLesson()
  lesson.deck = { ...lesson.deck, slides: [], title: 'Untitled lesson' }
  return lesson
}
const generating = async (lesson = emptyLesson()) => {
  const view = setupEditor({ lesson, view: { runningJob: RUNNING_GENERATION } })
  await screen.findByRole('navigation', { name: 'Slides' })
  return view
}
const progress = (stage: string, done: number, total: number, title?: string) =>
  ({ lessonId: LESSON, stage, done, total, ...(title ? { title } : {}) }) as never
const slideEvent = (id: string, index: number, text: string) =>
  ({
    lessonId: LESSON,
    index,
    slide: makeSlide(id, { elements: [makeText(`${id}-t`, text, { role: 'title' })] })
  }) as never
const thumbs = () =>
  within(screen.getByRole('navigation', { name: 'Slides' })).queryAllByRole('button', {
    name: /^Slide \d+(:|$)/
  })

describe('a lesson that is being generated', () => {
  it('opens view-only, with placeholders until the plan says how many slides come', async () => {
    const view = await generating()
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Lesson title' })).toBeDisabled()
    )
    expect(screen.getByRole('button', { name: 'Present' })).toHaveAttribute('aria-disabled', 'true')
    view.emit('gen-progress', progress('writing', 0, 6))
    expect(await screen.findByText('Building your slides')).toBeInTheDocument()
    expect(document.querySelectorAll('li[aria-hidden="true"]')).toHaveLength(6)
  })

  it('shows the title the plan produced before the deck on disk has it', async () => {
    const view = await generating()
    view.emit('gen-progress', progress('planning', 0, 6, 'Photosynthesis'))
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Lesson title' })).toHaveValue('Photosynthesis')
    )
  })

  it('adds each slide to the filmstrip as it is ready, in plan order', async () => {
    const view = await generating()
    view.emit('gen-progress', progress('writing', 0, 3))
    view.emit('slide-ready', slideEvent('g2', 1, 'Second'))
    view.emit('slide-ready', slideEvent('g1', 0, 'First'))
    await waitFor(() => expect(thumbs()).toHaveLength(2))
    expect(thumbs()[0]).toHaveAccessibleName(/First/)
    expect(thumbs()[1]).toHaveAccessibleName(/Second/)
  })

  it('selects the first slide as soon as it arrives', async () => {
    const view = await generating()
    view.emit('slide-ready', slideEvent('g1', 0, 'First'))
    await waitFor(() => expect(thumbs()[0]).toHaveAttribute('aria-current', 'true'))
  })

  it('ignores events of other lessons', async () => {
    const view = await generating()
    view.emit('slide-ready', {
      ...(slideEvent('x', 0, 'Other') as object),
      lessonId: 'les_other'
    } as never)
    expect(thumbs()).toHaveLength(0)
  })

  it('re-reads the deck when it is done and becomes editable', async () => {
    const lesson = emptyLesson()
    const view = await generating(lesson)
    view.emit('slide-ready', slideEvent('g1', 0, 'First'))
    lesson.deck = {
      ...lesson.deck,
      slides: [makeSlide('g1', { elements: [makeText('g1-t', 'First')] })]
    }
    view.db.openLesson.mockClear()
    view.emit('gen-progress', progress('done', 1, 1))
    await waitFor(() => expect(view.db.openLesson).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Lesson title' })).toBeEnabled())
    expect(thumbs()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Present' })).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByText(/Finish the rest/)).not.toBeInTheDocument()
  })

  it('offers to finish the rest when the job stopped early, and carries on', async () => {
    const view = await generating()
    view.emit('slide-ready', slideEvent('g1', 0, 'First'))
    view.emit('gen-progress', progress('error', 1, 4))
    expect(await screen.findByText(/1 of 4 slides made — Finish the rest\?/)).toBeInTheDocument()
    await view.user.click(screen.getByRole('button', { name: 'Finish the rest' }))
    expect(view.db.finishGeneration).toHaveBeenCalledWith({ lessonId: LESSON })
    await waitFor(() => expect(screen.queryByText(/Finish the rest\?/)).not.toBeInTheDocument())
  })

  it('says so when finishing is refused', async () => {
    const view = await generating()
    ;(
      view.db.finishGeneration as unknown as { mockImplementation(fn: unknown): void }
    ).mockImplementation(async () => fail('network', 'Claude is not reachable'))
    view.emit('gen-progress', progress('error', 1, 4))
    await view.user.click(await screen.findByRole('button', { name: 'Finish the rest' }))
    expect(await screen.findByText('Claude is not reachable')).toBeInTheDocument()
    expect(screen.getByText(/Finish the rest\?/)).toBeInTheDocument()
  })
})

describe('chat and plugin jobs', () => {
  const open = async (options = {}) => {
    const view = setupEditor(options)
    await screen.findByRole('navigation', { name: 'Slides' })
    return view
  }

  it('become view-only from chat:status running until chat:done', async () => {
    const view = await open()
    expect(screen.getByRole('button', { name: 'Present' })).not.toHaveAttribute('aria-disabled')
    view.emit('chat:status', { lessonId: LESSON, state: 'running' } as never)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Present' })).toHaveAttribute(
        'aria-disabled',
        'true'
      )
    )
    view.emit('chat:done', { lessonId: LESSON } as never)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Present' })).not.toHaveAttribute('aria-disabled')
    )
  })

  it('an AI error ends the busy state', async () => {
    const view = await open({ view: { runningJob: RUNNING_CHAT } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Present' })).toHaveAttribute(
        'aria-disabled',
        'true'
      )
    )
    view.emit('ai:error', { lessonId: LESSON, code: 'ai-unavailable', message: 'x' } as never)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Present' })).not.toHaveAttribute('aria-disabled')
    )
  })

  it('new slides from a ChangeSet flash orange for a second, then stop', async () => {
    const lesson = new FakeLesson()
    const view = await open({ lesson })
    const added = makeSlide('s4', { elements: [makeText('s4-t', 'Added', { role: 'title' })] })
    const ops = [{ op: 'insertSlides' as const, afterSlideId: 's3', slides: [added] }]
    expect(lesson.applyOps({ ops, summary: 'Added' }).ok).toBe(true)
    view.emit('chat:changes', {
      lessonId: LESSON,
      changeSet: { id: 'c', by: 'ai', summary: 'x', at: 'x', ops }
    } as never)
    await waitFor(() => expect(thumbs()).toHaveLength(4))
    await waitFor(() => expect(thumbs()[3]).toHaveAttribute('data-mark-flash'))
    expect(thumbs()[0]).not.toHaveAttribute('data-mark-flash')
    await waitFor(() => expect(thumbs()[3]).not.toHaveAttribute('data-mark-flash'), {
      timeout: 2500
    })
  })

  it('keeps the selection where it was when slides are added', async () => {
    const lesson = new FakeLesson()
    const view = await open({ lesson })
    await view.user.click(screen.getByRole('button', { name: /^Slide 2/ }))
    lesson.applyOps({
      ops: [{ op: 'insertSlides', afterSlideId: null, slides: [makeSlide('s0')] }],
      summary: 'Added'
    })
    view.emit('chat:changes', {
      lessonId: LESSON,
      changeSet: { id: 'c', by: 'ai', summary: 'x', at: 'x', ops: [] }
    } as never)
    await waitFor(() => expect(thumbs()).toHaveLength(4))
    expect(screen.getByRole('button', { name: /^Slide 3(:|$)/ })).toHaveAttribute(
      'aria-current',
      'true'
    )
  })
})
