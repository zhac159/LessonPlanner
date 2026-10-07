import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Element, TextElement } from '@shared/deck/types'
import { fail } from '@shared/result'
import { setupEditor } from './testing'
import { resetStubs } from './testStubs'

vi.mock('../chat', async () => (await import('./testStubs')).chatModule)
vi.mock('../circle', async () => (await import('./testStubs')).circleModule)

beforeEach(() => {
  resetStubs()
  window.localStorage.clear()
})

type View = Awaited<ReturnType<typeof open>>

const open = async (options = {}) => {
  const view = setupEditor(options)
  await screen.findByRole('navigation', { name: 'Slides' })
  return view
}
const stage = () => screen.getByRole('group', { name: 'Slide editing area' })
const title = () => screen.getByRole('button', { name: /^Text box: How do plants make food/ })
const textOf = (element: Element | undefined): string =>
  (element as TextElement).paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n')
const titleElement = (view: View): TextElement =>
  view.lesson.deck.slides[0].elements.find((e) => e.id === 's1-title') as TextElement
const lastCall = (view: View) => view.db.applyOps.mock.calls.at(-1)?.[0]

describe('picking elements', () => {
  it('only offers elements that are not locked decorations', async () => {
    await open()
    expect(title()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: /^Shape/ })).not.toBeInTheDocument()
  })

  it('a click picks an element; Esc on the stage lets go', async () => {
    const view = await open()
    await view.user.click(title())
    expect(title()).toHaveAttribute('aria-pressed', 'true')
    stage().focus()
    await view.user.keyboard('{Escape}')
    expect(title()).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking the empty stage lets go', async () => {
    const view = await open()
    await view.user.click(title())
    fireEvent.pointerDown(title().parentElement as HTMLElement)
    expect(title()).toHaveAttribute('aria-pressed', 'false')
  })

  it('Enter picks the first element, Tab walks to the next and leaves after the last', async () => {
    const view = await open()
    stage().focus()
    await view.user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: /^Text box: Lesson 3/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await view.user.keyboard('{Tab}')
    expect(title()).toHaveAttribute('aria-pressed', 'true')
  })

  it('picking resets when another slide is shown', async () => {
    const view = await open()
    await view.user.click(title())
    await view.user.click(screen.getByRole('button', { name: /^Slide 2/ }))
    expect(
      screen.queryByRole('button', { name: /^Text box: How do plants/ })
    ).not.toBeInTheDocument()
  })
})

describe('typing in an element', () => {
  it('double-click opens an editor with the text, and Ctrl+Enter saves one ChangeSet', async () => {
    const view = await open()
    await view.user.dblClick(title())
    const field = screen.getByRole('textbox', { name: /^Edit Text box: How do plants make food/ })
    expect(field).toHaveFocus()
    expect(field).toHaveValue('How do plants make food?')
    await view.user.clear(field)
    await view.user.type(field, 'Why do plants need light?')
    await view.user.keyboard('{Control>}{Enter}{/Control}')
    await waitFor(() => expect(textOf(titleElement(view))).toBe('Why do plants need light?'))
    expect(lastCall(view)).toMatchObject({ summary: 'Edited text' })
    expect(screen.queryByRole('textbox', { name: /^Edit/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Undo/ })).toBeEnabled()
  })

  it('Esc and clicking away both commit', async () => {
    const view = await open()
    await view.user.dblClick(title())
    await view.user.type(screen.getByRole('textbox', { name: /^Edit/ }), '!')
    await view.user.keyboard('{Escape}')
    await waitFor(() => expect(textOf(titleElement(view))).toBe('How do plants make food?!'))
    await view.user.dblClick(title())
    await view.user.type(screen.getByRole('textbox', { name: /^Edit/ }), '?')
    fireEvent.blur(screen.getByRole('textbox', { name: /^Edit/ }))
    await waitFor(() => expect(textOf(titleElement(view))).toBe('How do plants make food?!?'))
  })

  it('Enter adds a line instead of leaving the box', async () => {
    const view = await open()
    await view.user.dblClick(title())
    const field = screen.getByRole('textbox', { name: /^Edit/ })
    await view.user.type(field, '{Enter}Second line')
    expect(field).toHaveValue('How do plants make food?\nSecond line')
    expect(view.db.applyOps).not.toHaveBeenCalled()
  })

  it('does nothing when the text did not change', async () => {
    const view = await open()
    await view.user.dblClick(title())
    await view.user.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: /^Edit/ })).not.toBeInTheDocument()
    expect(view.db.applyOps).not.toHaveBeenCalled()
  })

  it('says so and keeps the deck when the change is refused', async () => {
    const view = await open({ deckBuilder: { applyOps: () => fail('invalid-input', 'No way') } })
    await view.user.dblClick(title())
    await view.user.type(screen.getByRole('textbox', { name: /^Edit/ }), '!')
    await view.user.keyboard('{Escape}')
    expect(await screen.findByText('No way')).toBeInTheDocument()
    expect(textOf(titleElement(view))).toBe('How do plants make food?')
  })

  it('says so when the call itself fails', async () => {
    const view = await open({
      deckBuilder: {
        applyOps: () => {
          throw new Error('ipc')
        }
      }
    })
    await view.user.dblClick(title())
    await view.user.type(screen.getByRole('textbox', { name: /^Edit/ }), '!')
    await view.user.keyboard('{Escape}')
    expect(
      await screen.findByText('Couldn’t make that change. Nothing was changed.')
    ).toBeInTheDocument()
  })
})

describe('moving and deleting an element', () => {
  it('arrow keys nudge the picked element 10 units, Shift 50', async () => {
    const view = await open()
    const { x, y } = titleElement(view)
    await view.user.click(title())
    stage().focus()
    await view.user.keyboard('{ArrowRight}')
    await waitFor(() => expect(titleElement(view).x).toBe(x + 10))
    await view.user.keyboard('{Shift>}{ArrowDown}{/Shift}')
    await waitFor(() => expect(titleElement(view).y).toBe(y + 50))
    expect(view.db.applyOps).toHaveBeenCalledTimes(2)
  })

  it('quick repeated nudges apply in order, each on the previous result', async () => {
    const view = await open()
    const { x } = titleElement(view)
    await view.user.click(title())
    stage().focus()
    await view.user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    await waitFor(() => expect(titleElement(view).x).toBe(x + 30))
  })

  it('arrow keys do nothing when no element is picked', async () => {
    const view = await open()
    stage().focus()
    await view.user.keyboard('{ArrowRight}')
    expect(view.db.applyOps).not.toHaveBeenCalled()
  })

  it('Delete removes the picked element in one step', async () => {
    const view = await open()
    await view.user.click(title())
    stage().focus()
    await view.user.keyboard('{Delete}')
    await waitFor(() => expect(titleElement(view)).toBeUndefined())
    expect(lastCall(view)).toMatchObject({ summary: 'Deleted an element' })
    expect(
      screen.queryByRole('button', { name: /^Text box: How do plants/ })
    ).not.toBeInTheDocument()
  })

  it('does not take keys that belong to a text field', async () => {
    const view = await open()
    await view.user.click(title())
    await view.user.dblClick(title())
    const field = await screen.findByRole('textbox', { name: /^Edit/ })
    await view.user.type(field, '{Backspace}')
    expect(view.db.applyOps).not.toHaveBeenCalled()
  })

  it('dragging an element commits one move on release', async () => {
    const view = await open()
    const { x, y } = titleElement(view)
    const button = title()
    button.setPointerCapture = vi.fn()
    fireEvent.pointerDown(button, { clientX: 0, clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(button, { clientX: 25, clientY: 10, pointerId: 1 })
    fireEvent.pointerUp(button, { clientX: 25, clientY: 10, pointerId: 1 })
    await waitFor(() => expect(titleElement(view).x).toBe(x + 100))
    expect(titleElement(view).y).toBe(y + 40)
    expect(view.db.applyOps).toHaveBeenCalledTimes(1)
  })
})

describe('the Text tool', () => {
  const layer = () => document.querySelector('.element-layer') as HTMLElement

  it('click places a box, typing then leaving adds it as one element and returns to Select', async () => {
    const view = await open()
    await view.user.click(screen.getByRole('button', { name: 'Text' }))
    fireEvent.pointerDown(layer())
    const field = await screen.findByRole('textbox', { name: 'New text box' })
    expect(field).toHaveFocus()
    await view.user.type(field, 'A new idea')
    await view.user.keyboard('{Escape}')
    await waitFor(() =>
      expect(
        view.lesson.deck.slides[0].elements.some(
          (e) => e.type === 'text' && textOf(e) === 'A new idea'
        )
      ).toBe(true)
    )
    expect(lastCall(view)).toMatchObject({ summary: 'Added a text box' })
    expect(screen.getByRole('button', { name: /^Select/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('discards an empty box', async () => {
    const view = await open()
    await view.user.click(screen.getByRole('button', { name: 'Text' }))
    fireEvent.pointerDown(layer())
    await screen.findByRole('textbox', { name: 'New text box' })
    await view.user.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: 'New text box' })).not.toBeInTheDocument()
    expect(view.db.applyOps).not.toHaveBeenCalled()
  })
})

describe('the Draw tool', () => {
  it('is not built yet: it says so and stays on Select', async () => {
    const view = await open()
    await view.user.click(screen.getByRole('button', { name: /^Draw/ }))
    expect(await screen.findByText('Drawing for the assistant is coming soon.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Select/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
