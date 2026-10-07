import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupEditor } from './testing'
import { resetStubs, seen } from './testStubs'

vi.mock('../chat', async () => (await import('./testStubs')).chatModule)
vi.mock('../circle', async () => (await import('./testStubs')).circleModule)

beforeEach(() => {
  resetStubs()
  window.localStorage.clear()
})

const thumb = (n: number): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(`^Slide ${n}(:|$)`) })
const strip = () => within(screen.getByRole('navigation', { name: 'Slides' }))
const thumbs = () => strip().getAllByRole('button', { name: /^Slide \d+(:|$)/ })
const open = async (options = {}) => {
  const view = setupEditor(options)
  await screen.findByRole('navigation', { name: 'Slides' })
  return view
}
const current = (): string | null => seen.chat?.currentSlideId ?? null
const lastOps = (view: Awaited<ReturnType<typeof open>>) =>
  view.db.applyOps.mock.calls[view.db.applyOps.mock.calls.length - 1][0]

describe('filmstrip: selecting', () => {
  it('a click selects a slide and tells the chat', async () => {
    const view = await open()
    await view.user.click(thumb(2))
    expect(thumb(2)).toHaveAttribute('aria-current', 'true')
    expect(current()).toBe('s2')
    expect(seen.chat?.selectedSlideIds).toEqual(['s2'])
  })

  it('remembers the slide for the next time the lesson opens', async () => {
    const view = await open()
    await view.user.click(thumb(3))
    expect(window.localStorage.getItem('slide-planner:last-slide:les_1')).toBe('s3')
  })

  it('Shift+click selects a range and the last click is on the stage', async () => {
    const view = await open()
    await view.user.keyboard('{Shift>}')
    await view.user.click(thumb(3))
    await view.user.keyboard('{/Shift}')
    expect(seen.chat?.selectedSlideIds).toEqual(['s1', 's2', 's3'])
    expect(current()).toBe('s3')
    await waitFor(() => expect(thumb(2)).toHaveAttribute('data-mark-multi'))
    expect(thumb(3)).not.toHaveAttribute('data-mark-multi')
  })

  it('Ctrl+click toggles one slide', async () => {
    const view = await open()
    await view.user.keyboard('{Control>}')
    await view.user.click(thumb(3))
    expect(seen.chat?.selectedSlideIds).toEqual(['s1', 's3'])
    await view.user.click(thumb(3))
    await view.user.keyboard('{/Control}')
    expect(seen.chat?.selectedSlideIds).toEqual(['s1'])
  })

  it('arrow keys move the selection and the focus; Home and End go to the ends', async () => {
    const view = await open()
    thumb(1).focus()
    await view.user.keyboard('{ArrowRight}')
    expect(current()).toBe('s2')
    expect(thumb(2)).toHaveFocus()
    await view.user.keyboard('{End}')
    expect(current()).toBe('s3')
    await view.user.keyboard('{ArrowRight}')
    expect(current()).toBe('s3')
    await view.user.keyboard('{Home}')
    expect(current()).toBe('s1')
    expect(thumb(1)).toHaveFocus()
  })

  it('Shift+arrows grow a range, and Esc goes back to one slide', async () => {
    const view = await open()
    thumb(1).focus()
    await view.user.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift}')
    expect(seen.chat?.selectedSlideIds).toEqual(['s1', 's2', 's3'])
    await view.user.keyboard('{Escape}')
    expect(seen.chat?.selectedSlideIds).toEqual(['s3'])
  })

  it('Enter moves focus to the stage', async () => {
    const view = await open()
    thumb(2).focus()
    await view.user.keyboard('{Enter}')
    expect(current()).toBe('s2')
    expect(screen.getByRole('group', { name: 'Slide editing area' })).toHaveFocus()
  })

  it('PageDown and PageUp on the stage change slides', async () => {
    const view = await open()
    screen.getByRole('group', { name: 'Slide editing area' }).focus()
    await view.user.keyboard('{PageDown}')
    expect(current()).toBe('s2')
    await view.user.keyboard('{PageUp}')
    expect(current()).toBe('s1')
  })
})

describe('filmstrip: changing slides', () => {
  it('Delete on a focused thumbnail deletes the slide, with a toast that offers Undo', async () => {
    const view = await open()
    thumb(2).focus()
    await view.user.keyboard('{Delete}')
    await waitFor(() => expect(thumbs()).toHaveLength(2))
    expect(lastOps(view)).toMatchObject({
      ops: [{ op: 'deleteSlides', slideIds: ['s2'] }],
      summary: 'Deleted 1 slide'
    })
    expect(screen.getByText('Slide deleted')).toBeInTheDocument()
    await view.user.click(
      within(screen.getByRole('region', { name: 'Notifications' })).getByRole('button', {
        name: 'Undo'
      })
    )
    await waitFor(() => expect(view.db.undo).toHaveBeenCalled())
    await waitFor(() => expect(thumbs()).toHaveLength(3))
  })

  it('deletes every selected slide in one step', async () => {
    const view = await open()
    await view.user.keyboard('{Shift>}')
    await view.user.click(thumb(2))
    await view.user.keyboard('{/Shift}')
    thumb(2).focus()
    await view.user.keyboard('{Delete}')
    await waitFor(() => expect(thumbs()).toHaveLength(1))
    expect(view.db.applyOps).toHaveBeenCalledTimes(1)
    expect(lastOps(view).ops).toEqual([{ op: 'deleteSlides', slideIds: ['s1', 's2'] }])
    expect(screen.getByText('2 slides deleted')).toBeInTheDocument()
  })

  it('selects the neighbour when the slide on the stage was deleted', async () => {
    const view = await open()
    await view.user.click(thumb(2))
    thumb(2).focus()
    await view.user.keyboard('{Delete}')
    await waitFor(() => expect(thumbs()).toHaveLength(2))
    expect(current()).toBe('s3')
  })

  it('Alt+Right moves the slide as one moveSlide ChangeSet', async () => {
    const view = await open()
    thumb(1).focus()
    await view.user.keyboard('{Alt>}{ArrowRight}{/Alt}')
    await waitFor(() =>
      expect(view.lesson.deck.slides.map((s) => s.id)).toEqual(['s2', 's1', 's3'])
    )
    expect(lastOps(view).ops).toEqual([{ op: 'moveSlide', slideId: 's1', afterSlideId: 's2' }])
    await waitFor(() => expect(thumbs()[1]).toHaveAttribute('data-slide-id', 's1'))
  })

  it('the + button adds a blank slide after the selected one and selects it', async () => {
    const view = await open()
    await view.user.click(thumb(2))
    await view.user.click(screen.getByRole('button', { name: 'Add slide' }))
    await waitFor(() => expect(thumbs()).toHaveLength(4))
    const op = lastOps(view).ops[0]
    expect(op).toMatchObject({ op: 'insertSlides', afterSlideId: 's2' })
    expect(view.lesson.deck.slides[2].id).toBe(op.slides[0].id)
    await waitFor(() => expect(current()).toBe(op.slides[0].id))
  })
})

describe('filmstrip: the thumbnail menu', () => {
  const openMenu = async (n: number) => {
    fireEvent.contextMenu(thumb(n), { clientX: 40, clientY: 40 })
    return screen.findByRole('menu', { name: 'Slide actions' })
  }

  it('lists the five actions; Move left is off for the first slide', async () => {
    await open()
    const menu = await openMenu(1)
    for (const name of [
      'Duplicate slide',
      'Delete slide',
      'Move left',
      'Move right',
      'Add slide after'
    ]) {
      expect(within(menu).getByRole('menuitem', { name })).toBeInTheDocument()
    }
    expect(within(menu).getByRole('menuitem', { name: 'Move left' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  it('Duplicate inserts a copy after the slide and selects it', async () => {
    const view = await open()
    const menu = await openMenu(2)
    await view.user.click(within(menu).getByRole('menuitem', { name: 'Duplicate slide' }))
    await waitFor(() => expect(thumbs()).toHaveLength(4))
    expect(lastOps(view)).toMatchObject({ summary: 'Duplicated a slide' })
    expect(view.lesson.deck.slides[2].elements[0].id).not.toBe('s2-band')
    await waitFor(() => expect(current()).toBe(view.lesson.deck.slides[2].id))
  })

  it('Delete removes the slide', async () => {
    const view = await open()
    const menu = await openMenu(3)
    await view.user.click(within(menu).getByRole('menuitem', { name: 'Delete slide' }))
    await waitFor(() => expect(thumbs()).toHaveLength(2))
  })

  it('Move right and Move left reorder through moveSlide', async () => {
    const view = await open()
    await view.user.click(
      await openMenu(1).then((m) => within(m).getByRole('menuitem', { name: 'Move right' }))
    )
    await waitFor(() =>
      expect(view.lesson.deck.slides.map((s) => s.id)).toEqual(['s2', 's1', 's3'])
    )
    await view.user.click(
      await openMenu(3).then((m) => within(m).getByRole('menuitem', { name: 'Move left' }))
    )
    await waitFor(() =>
      expect(view.lesson.deck.slides.map((s) => s.id)).toEqual(['s2', 's3', 's1'])
    )
  })

  it('Add slide after adds a blank slide there', async () => {
    const view = await open()
    const menu = await openMenu(1)
    await view.user.click(within(menu).getByRole('menuitem', { name: 'Add slide after' }))
    await waitFor(() => expect(view.lesson.deck.slides).toHaveLength(4))
    expect(view.lesson.deck.slides[0].id).toBe('s1')
  })

  it('opens from the keyboard with Shift+F10', async () => {
    const view = await open()
    thumb(2).focus()
    await view.user.keyboard('{Shift>}{F10}{/Shift}')
    expect(await screen.findByRole('menu', { name: 'Slide actions' })).toBeInTheDocument()
  })
})
