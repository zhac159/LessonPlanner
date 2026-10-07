import { createEvent, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Slide } from '@shared/deck/types'
import { Filmstrip, type FilmstripProps } from './Filmstrip'

const titled = (id: string, title: string): Slide => ({
  id,
  kind: 'content',
  elements: [
    {
      id: `${id}-t`,
      type: 'text',
      role: 'title',
      x: 0,
      y: 0,
      w: 800,
      h: 100,
      paragraphs: [{ runs: [{ text: title }] }]
    }
  ]
})
const slides = [titled('a', 'One'), titled('b', 'Two'), titled('c', 'Three'), titled('d', 'Four')]

function setup(props: Partial<FilmstripProps> = {}) {
  const handlers = {
    onSelect: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    onAdd: vi.fn(),
    onSlideMenu: vi.fn()
  }
  const utils = render(
    <Filmstrip slides={slides} styleProfile={null} selectedId="b" {...handlers} {...props} />
  )
  const thumb = (n: number) => screen.getByRole('button', { name: new RegExp(`^Slide ${n}:`) })
  return { ...utils, ...handlers, thumb }
}

describe('Filmstrip', () => {
  it('is a navigation landmark of numbered slide buttons plus Add slide', () => {
    const { thumb } = setup()
    const nav = screen.getByRole('navigation', { name: 'Slides' })
    expect(within(nav).getAllByRole('button')).toHaveLength(5)
    expect(thumb(3)).toHaveAccessibleName('Slide 3: Three')
    expect(screen.getByRole('button', { name: 'Add slide' })).toBeInTheDocument()
  })

  it('marks only the selected slide as current', () => {
    const { thumb } = setup()
    expect(thumb(2)).toHaveAttribute('aria-current', 'true')
    expect(thumb(1)).not.toHaveAttribute('aria-current')
  })

  it('selects a slide on click and on Enter', async () => {
    const user = userEvent.setup()
    const { thumb, onSelect } = setup()
    await user.click(thumb(3))
    thumb(4).focus()
    await user.keyboard('{Enter}')
    expect(onSelect.mock.calls).toEqual([['c'], ['d']])
  })

  it('offers Add slide only when onAdd is given, and calls it', async () => {
    const { onAdd } = setup()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add slide' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('has no Add slide button without onAdd', () => {
    setup({ onAdd: undefined })
    expect(screen.queryByRole('button', { name: 'Add slide' })).not.toBeInTheDocument()
  })

  describe('keyboard', () => {
    it('is one tab stop on the selected slide', () => {
      const { thumb } = setup()
      expect(thumb(2)).toHaveAttribute('tabindex', '0')
      expect([1, 3, 4].map((n) => thumb(n).getAttribute('tabindex'))).toEqual(['-1', '-1', '-1'])
    })

    it('starts at the first slide when none is selected', () => {
      const { thumb } = setup({ selectedId: null })
      expect(thumb(1)).toHaveAttribute('tabindex', '0')
    })

    it('moves focus with the arrow keys and takes the tab stop along', async () => {
      const user = userEvent.setup()
      const { thumb, onSelect } = setup()
      thumb(2).focus()
      await user.keyboard('{ArrowRight}')
      expect(thumb(3)).toHaveFocus()
      expect(thumb(3)).toHaveAttribute('tabindex', '0')
      expect(thumb(2)).toHaveAttribute('tabindex', '-1')
      await user.keyboard('{ArrowLeft}{ArrowLeft}')
      expect(thumb(1)).toHaveFocus()
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('stops at both ends instead of wrapping', async () => {
      const user = userEvent.setup()
      const { thumb } = setup()
      thumb(1).focus()
      await user.keyboard('{ArrowLeft}')
      expect(thumb(1)).toHaveFocus()
      thumb(4).focus()
      await user.keyboard('{ArrowRight}')
      expect(thumb(4)).toHaveFocus()
    })

    it('Up and Down move too (vertical layout)', async () => {
      const user = userEvent.setup()
      const { thumb } = setup({ layout: 'vertical' })
      thumb(1).focus()
      await user.keyboard('{ArrowDown}')
      expect(thumb(2)).toHaveFocus()
      await user.keyboard('{ArrowUp}')
      expect(thumb(1)).toHaveFocus()
    })

    it('Home and End jump to the first and last slide', async () => {
      const user = userEvent.setup()
      const { thumb } = setup()
      thumb(2).focus()
      await user.keyboard('{End}')
      expect(thumb(4)).toHaveFocus()
      await user.keyboard('{Home}')
      expect(thumb(1)).toHaveFocus()
    })

    it('Alt+Arrow reorders by one place and announces it', async () => {
      const user = userEvent.setup()
      const { thumb, onMove } = setup()
      thumb(3).focus()
      await user.keyboard('{Alt>}{ArrowLeft}{/Alt}')
      expect(onMove).toHaveBeenLastCalledWith('c', 'a')
      expect(screen.getByRole('status')).toHaveTextContent('Slide moved to position 2 of 4')
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
      expect(onMove).toHaveBeenLastCalledWith('c', 'd')
      expect(onMove).toHaveBeenCalledTimes(2)
    })

    it('Alt+ArrowUp on the second slide moves it to the front', async () => {
      const user = userEvent.setup()
      const { thumb, onMove } = setup()
      thumb(2).focus()
      await user.keyboard('{Alt>}{ArrowUp}{/Alt}')
      expect(onMove).toHaveBeenCalledWith('b', null)
    })

    it('does not reorder past either end', async () => {
      const user = userEvent.setup()
      const { thumb, onMove } = setup()
      thumb(1).focus()
      await user.keyboard('{Alt>}{ArrowLeft}{/Alt}')
      thumb(4).focus()
      await user.keyboard('{Alt>}{ArrowRight}{/Alt}')
      expect(onMove).not.toHaveBeenCalled()
    })

    it('keeps focus on the moved slide after the parent reorders', async () => {
      const user = userEvent.setup()
      const { thumb, rerender, onSelect } = setup()
      thumb(3).focus()
      await user.keyboard('{Alt>}{ArrowLeft}{/Alt}')
      const reordered = [slides[0], slides[2], slides[1], slides[3]]
      rerender(
        <Filmstrip slides={reordered} styleProfile={null} selectedId="b" onSelect={onSelect} />
      )
      expect(screen.getByRole('button', { name: 'Slide 2: Three' })).toHaveFocus()
    })

    it('ignores Alt+Arrow when reordering is not available', async () => {
      const user = userEvent.setup()
      const { thumb } = setup({ onMove: undefined })
      thumb(3).focus()
      await user.keyboard('{Alt>}{ArrowLeft}{/Alt}')
      expect(thumb(3)).toHaveFocus()
    })

    it('Delete asks to remove the focused slide', async () => {
      const user = userEvent.setup()
      const { thumb, onDelete } = setup()
      thumb(3).focus()
      await user.keyboard('{Delete}')
      expect(onDelete).toHaveBeenCalledWith('c')
    })

    it('ignores Delete without onDelete and keys pressed on Add slide', async () => {
      const user = userEvent.setup()
      const { thumb, onDelete } = setup({ onDelete: undefined })
      thumb(3).focus()
      await user.keyboard('{Delete}')
      screen.getByRole('button', { name: 'Add slide' }).focus()
      await user.keyboard('{ArrowLeft}{Delete}')
      expect(onDelete).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Add slide' })).toHaveFocus()
    })
  })

  describe('context menu', () => {
    it('reports the slide id and the anchor', () => {
      const { thumb, onSlideMenu } = setup()
      fireEvent.contextMenu(thumb(3), { clientX: 30, clientY: 40 })
      expect(onSlideMenu).toHaveBeenCalledWith('c', { x: 30, y: 40 })
    })
  })

  describe('drag and drop', () => {
    /** happy-dom's DragEvent carries no coordinates: add them (the layout is all zeros, so the middle is 0). */
    const pointer = (
      type: 'dragOver' | 'drop',
      el: HTMLElement,
      side: 'before' | 'after'
    ): void => {
      const event = createEvent[type](el)
      const at = side === 'before' ? -5 : 20
      Object.defineProperty(event, 'clientX', { value: at })
      Object.defineProperty(event, 'clientY', { value: at })
      fireEvent(el, event)
    }
    const item = (n: number) =>
      screen.getByRole('button', { name: new RegExp(`^Slide ${n}:`) }).closest('li')!

    it('makes slides draggable only when they can be moved', () => {
      const { unmount } = setup()
      expect(item(1)).toHaveAttribute('draggable', 'true')
      unmount()
      setup({ onMove: undefined })
      expect(item(1)).not.toHaveAttribute('draggable')
    })

    it('drops after the target when released on its far half', () => {
      const { onMove } = setup()
      fireEvent.dragStart(item(1))
      pointer('dragOver', item(3), 'after')
      expect(item(3)).toHaveAttribute('data-drop', 'after')
      pointer('drop', item(3), 'after')
      expect(onMove).toHaveBeenCalledWith('a', 'c')
      expect(item(3)).not.toHaveAttribute('data-drop')
    })

    it('drops before the target when released on its near half', () => {
      const { onMove } = setup()
      fireEvent.dragStart(item(4))
      pointer('dragOver', item(1), 'before')
      expect(item(1)).toHaveAttribute('data-drop', 'before')
      pointer('drop', item(1), 'before')
      expect(onMove).toHaveBeenCalledWith('d', null)
    })

    it('uses the vertical axis in the vertical layout', () => {
      const { onMove } = setup({ layout: 'vertical' })
      fireEvent.dragStart(item(1))
      pointer('drop', item(2), 'after')
      expect(onMove).toHaveBeenCalledWith('a', 'b')
    })

    it('fades the dragged slide and ends cleanly on dragend', () => {
      const { thumb } = setup()
      fireEvent.dragStart(item(2))
      expect(thumb(2)).toHaveAttribute('data-dragging')
      pointer('dragOver', item(3), 'after')
      fireEvent.dragEnd(item(2))
      expect(thumb(2)).not.toHaveAttribute('data-dragging')
      expect(item(3)).not.toHaveAttribute('data-drop')
    })

    it('does nothing when dropped where it already is', () => {
      const { onMove } = setup()
      fireEvent.dragStart(item(2))
      pointer('drop', item(2), 'after')
      fireEvent.dragStart(item(2))
      pointer('drop', item(3), 'before')
      expect(onMove).not.toHaveBeenCalled()
    })

    it('ignores drags that did not start on a slide', () => {
      const { onMove } = setup()
      pointer('dragOver', item(2), 'after')
      pointer('drop', item(2), 'after')
      expect(onMove).not.toHaveBeenCalled()
      expect(item(2)).not.toHaveAttribute('data-drop')
    })
  })

  describe('generating and empty', () => {
    it('shows four quiet placeholders and no slide buttons when empty', () => {
      const { container } = setup({ slides: [], selectedId: null, onAdd: undefined })
      const slots = container.querySelectorAll('[data-variant="placeholder"]')
      expect(slots).toHaveLength(4)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('shows pulsing placeholders after the slides that have arrived and says so', () => {
      const { container } = setup({ slides: slides.slice(0, 2), pendingCount: 3 })
      expect(container.querySelectorAll('[data-variant="generating"]')).toHaveLength(3)
      expect(screen.getAllByRole('button', { name: /^Slide \d/ })).toHaveLength(2)
      expect(screen.getByRole('status')).toHaveTextContent('Building your slides')
    })

    it('shows only placeholders while nothing has arrived yet', () => {
      const { container } = setup({ slides: [], selectedId: null, pendingCount: 6 })
      expect(container.querySelectorAll('[data-variant="generating"]')).toHaveLength(6)
      expect(container.querySelectorAll('[data-variant="placeholder"]')).toHaveLength(0)
    })

    it('flags streamed thumbnails for the reveal animation', () => {
      const { thumb } = setup({ reveal: true })
      expect(thumb(1)).toHaveAttribute('data-reveal')
    })
  })

  it('lays out vertically on request', () => {
    setup({ layout: 'vertical' })
    expect(screen.getByRole('navigation')).toHaveAttribute('data-layout', 'vertical')
  })

  it('scrolls the selected slide into view', () => {
    const original = Element.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    try {
      setup()
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })
})
