import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { fixtureDeck, makeText } from '@shared/deck/testing'
import type { Element } from '@shared/deck/types'
import { ChatSkeleton, EditorSkeleton, LessonLoadError, StoppedBanner } from './LessonStates'
import { InlineTextEditor } from './InlineTextEditor'
import { StickyNoteLayer } from './StickyNoteLayer'
import { TitleField } from './TitleField'
import { ElementLayer } from './ElementLayer'

describe('TitleField', () => {
  it('shows the title as an accessible text field', () => {
    render(<TitleField title="Cells" onCommit={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Lesson title' })).toHaveValue('Cells')
  })

  it('collapses spaces and commits on Enter', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<TitleField title="Cells" onCommit={onCommit} />)
    const field = screen.getByRole('textbox', { name: 'Lesson title' })
    await user.clear(field)
    await user.type(field, '  Plant   cells {Enter}')
    expect(onCommit).toHaveBeenCalledWith('Plant cells')
  })

  it('does not commit an unchanged or empty title', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<TitleField title="Cells" onCommit={onCommit} />)
    const field = screen.getByRole('textbox', { name: 'Lesson title' })
    await user.click(field)
    await user.tab()
    await user.clear(field)
    await user.tab()
    expect(onCommit).not.toHaveBeenCalled()
    expect(field).toHaveValue('Cells')
  })

  it('Esc reverts without committing and without leaving the screen’s Esc handlers to see it', async () => {
    const onCommit = vi.fn()
    const outer = vi.fn()
    const user = userEvent.setup()
    render(
      <div onKeyDown={outer}>
        <TitleField title="Cells" onCommit={onCommit} />
      </div>
    )
    const field = screen.getByRole('textbox', { name: 'Lesson title' })
    await user.type(field, ' more{Escape}')
    expect(field).toHaveValue('Cells')
    expect(onCommit).not.toHaveBeenCalled()
    expect(outer.mock.calls.some(([e]) => e.key === 'Escape')).toBe(false)
  })

  it('keeps what is typed before React has run its first effects (a late effect must not wipe it)', async () => {
    const globals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const wasAct = globals.IS_REACT_ACT_ENVIRONMENT
    globals.IS_REACT_ACT_ENVIRONMENT = false
    const host = document.body.appendChild(document.createElement('div'))
    const root = createRoot(host)
    try {
      root.render(<TitleField title="Cells" onCommit={vi.fn()} />)
      // Resolves in a microtask right after the commit, before the scheduler runs the passive effects.
      const field = await new Promise<HTMLInputElement>((resolve) => {
        const watch = new MutationObserver(() => {
          const found = host.querySelector('input')
          if (!found) return
          watch.disconnect()
          resolve(found)
        })
        watch.observe(host, { childList: true, subtree: true })
      })
      // The first effects are still pending: the teacher already types.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, '')
      field.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(field.value).toBe('')
    } finally {
      flushSync(() => root.unmount())
      host.remove()
      globals.IS_REACT_ACT_ENVIRONMENT = wasAct
    }
  })

  it('follows a title that changed from outside, and can be locked', () => {
    const { rerender } = render(<TitleField title="One" onCommit={vi.fn()} />)
    rerender(<TitleField title="Two" disabled onCommit={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Lesson title' })).toHaveValue('Two')
    expect(screen.getByRole('textbox', { name: 'Lesson title' })).toBeDisabled()
  })
})

describe('LessonStates', () => {
  it('LessonLoadError names the problem, announces it and goes back', async () => {
    const onBack = vi.fn()
    render(<LessonLoadError onBack={onBack} />)
    expect(screen.getByRole('alert')).toHaveTextContent('This lesson couldn’t be opened.')
    await userEvent.click(screen.getByRole('button', { name: 'Back to Home' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('the skeletons are named for assistive tech or hidden', () => {
    const { container } = render(
      <>
        <EditorSkeleton />
        <ChatSkeleton />
      </>
    )
    expect(screen.getByRole('status', { name: 'Opening your lesson' })).toBeInTheDocument()
    expect(container.querySelector('.editor-skeleton--chat')).toHaveAttribute('aria-hidden', 'true')
  })

  it('StoppedBanner says how far it got and offers to finish', async () => {
    const onFinish = vi.fn()
    const { rerender } = render(
      <StoppedBanner done={5} total={8} busy={false} onFinish={onFinish} />
    )
    expect(screen.getByText(/5 of 8 slides made — Finish the rest\?/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Finish the rest' }))
    expect(onFinish).toHaveBeenCalled()
    rerender(<StoppedBanner done={5} total={8} busy onFinish={onFinish} />)
    expect(screen.getByRole('button', { name: 'Finish the rest' })).toBeDisabled()
  })
})

describe('InlineTextEditor', () => {
  const box = { left: 0, top: 0, width: 100, height: 40 }

  it('takes focus and selects the text of an existing element', () => {
    render(
      <InlineTextEditor box={box} initial="Hello" fontPx={20} label="Edit" onCommit={vi.fn()} />
    )
    const field = screen.getByRole('textbox', { name: 'Edit' }) as HTMLTextAreaElement
    expect(field).toHaveFocus()
    expect(field.selectionStart).toBe(0)
    expect(field.selectionEnd).toBe(5)
  })

  it('commits exactly once, however it ends', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(
      <InlineTextEditor box={box} initial="Hello" fontPx={20} label="Edit" onCommit={onCommit} />
    )
    await user.keyboard('X{Escape}')
    fireEvent.blur(screen.getByRole('textbox', { name: 'Edit' }))
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('X')
  })

  it('Ctrl+Enter commits; plain Enter stays in the box', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<InlineTextEditor box={box} initial="" fontPx={20} label="Edit" onCommit={onCommit} />)
    await user.keyboard('a{Enter}b')
    expect(onCommit).not.toHaveBeenCalled()
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(onCommit).toHaveBeenCalledWith('a\nb')
  })
})

describe('StickyNoteLayer', () => {
  const note = { id: 'n1', slideId: 's1', x: 100, y: 100, text: 'Remember' }
  const box = { scale: 0.5, width: 960, height: 540 }

  it('draws each note as an editable field with a delete button', async () => {
    const onEdit = vi.fn()
    const onRemove = vi.fn()
    const user = userEvent.setup()
    render(
      <StickyNoteLayer
        notes={[note]}
        box={box}
        focusId={null}
        onEdit={onEdit}
        onCommit={vi.fn()}
        onRemove={onRemove}
      />
    )
    await user.type(screen.getByRole('textbox', { name: 'Sticky note' }), '!')
    expect(onEdit).toHaveBeenCalledWith('n1', 'Remember!')
    await user.click(screen.getByRole('button', { name: 'Delete note' }))
    expect(onRemove).toHaveBeenCalledWith('n1')
  })

  it('focuses a note that was just placed, commits on blur and on Esc', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(
      <StickyNoteLayer
        notes={[note]}
        box={box}
        focusId="n1"
        onEdit={vi.fn()}
        onCommit={onCommit}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByRole('textbox', { name: 'Sticky note' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(onCommit).toHaveBeenCalledWith('n1')
  })

  it('keeps notes inside the stage', () => {
    render(
      <StickyNoteLayer
        notes={[{ ...note, x: 1900, y: 1070 }]}
        box={box}
        focusId={null}
        onEdit={vi.fn()}
        onCommit={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    const card = screen.getByRole('textbox', { name: 'Sticky note' }).parentElement as HTMLElement
    expect(parseFloat(card.style.left)).toBeLessThanOrEqual(960 - 190)
    expect(parseFloat(card.style.top)).toBeLessThanOrEqual(540 - 96)
  })
})

describe('ElementLayer', () => {
  const slide = fixtureDeck().slides[0]
  const handlers = () => ({
    onSelect: vi.fn(),
    onStartEdit: vi.fn(),
    onCommitEdit: vi.fn(),
    onCommitDraft: vi.fn(),
    onMove: vi.fn(),
    onPlace: vi.fn()
  })
  const layer = (over: Partial<Parameters<typeof ElementLayer>[0]> = {}) => {
    const h = handlers()
    render(
      <ElementLayer
        slide={slide}
        scale={0.5}
        tool="select"
        readOnly={false}
        selectedId={null}
        editingId={null}
        draft={null}
        {...h}
        {...over}
      />
    )
    return h
  }
  const title = () => screen.getByRole('button', { name: /^Text box: How do plants/ })

  it('offers a button for every element she may pick, named by kind and text', () => {
    layer()
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: 'Text box: Lesson 3 · Year 8 Science' })
    ).toBeInTheDocument()
  })

  it('places each button in pixels from slide units', () => {
    layer()
    const el = slide.elements.find((e) => e.id === 's1-title') as Element
    expect(title().style.left).toBe(`${el.x * 0.5}px`)
    expect(title().style.width).toBe(`${el.w * 0.5}px`)
  })

  it('marks the picked one with aria-pressed', () => {
    layer({ selectedId: 's1-title' })
    expect(title()).toHaveAttribute('aria-pressed', 'true')
  })

  it('a double-click starts editing text, unless the stage is view-only', async () => {
    const h = layer()
    await userEvent.dblClick(title())
    expect(h.onStartEdit).toHaveBeenCalledWith('s1-title')
  })

  it('view-only: picks but neither edits nor drags', () => {
    const h = layer({ readOnly: true })
    fireEvent.doubleClick(title())
    fireEvent.pointerDown(title(), { clientX: 0, clientY: 0 })
    fireEvent.pointerMove(title(), { clientX: 50, clientY: 50 })
    fireEvent.pointerUp(title())
    expect(h.onSelect).toHaveBeenCalledWith('s1-title')
    expect(h.onStartEdit).not.toHaveBeenCalled()
    expect(h.onMove).not.toHaveBeenCalled()
  })

  it('a drag moves by the pointer distance in slide units; a click or a cancel does not move', () => {
    const el = slide.elements.find((e) => e.id === 's1-title') as Element
    const h = layer()
    title().setPointerCapture = vi.fn()
    fireEvent.pointerDown(title(), { clientX: 0, clientY: 0 })
    fireEvent.pointerUp(title())
    expect(h.onMove).not.toHaveBeenCalled()
    fireEvent.pointerDown(title(), { clientX: 0, clientY: 0 })
    fireEvent.pointerMove(title(), { clientX: 10, clientY: 20 })
    fireEvent.pointerCancel(title())
    expect(h.onMove).not.toHaveBeenCalled()
    fireEvent.pointerDown(title(), { clientX: 0, clientY: 0 })
    fireEvent.pointerMove(title(), { clientX: 10, clientY: 20 })
    fireEvent.pointerUp(title())
    expect(h.onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 's1-title' }), {
      x: el.x + 20,
      y: el.y + 40
    })
  })

  it('other tools make the elements pass the pointer through', () => {
    const h = layer({ tool: 'circle' })
    expect(title()).toHaveAttribute('data-passive')
    fireEvent.pointerDown(title())
    expect(h.onSelect).not.toHaveBeenCalled()
  })

  it('the Text and Note tools place on the empty layer only', () => {
    const text = layer({ tool: 'text' })
    const el = document.querySelector('.element-layer') as HTMLElement
    fireEvent.pointerDown(title())
    expect(text.onPlace).not.toHaveBeenCalled()
    fireEvent.pointerDown(el)
    expect(text.onPlace).toHaveBeenCalledWith('text', expect.any(Object))
  })

  it('shows the editor for the element being edited, in place of its button', () => {
    layer({ editingId: 's1-title' })
    expect(
      screen.queryByRole('button', { name: /^Text box: How do plants/ })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Edit Text box: How do plants/ })).toHaveFocus()
  })

  it('locked elements are never offered, even for editing', () => {
    const locked = makeText('lk', 'Locked', { locked: true })
    render(
      <ElementLayer
        slide={{ ...slide, elements: [locked] }}
        scale={1}
        tool="select"
        readOnly={false}
        selectedId={null}
        editingId={null}
        draft={null}
        {...handlers()}
      />
    )
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
