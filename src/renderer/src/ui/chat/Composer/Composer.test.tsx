import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Composer, MAX_ATTACHMENTS, type ComposerProps } from './Composer'

/** A controlled Composer, as a screen would use it. */
function Harness({
  initial = '',
  ...props
}: { initial?: string } & Partial<Omit<ComposerProps, 'value' | 'onChange'>>) {
  const [value, setValue] = useState(initial)
  return <Composer value={value} onChange={setValue} onSend={() => {}} {...props} />
}

const box = (): HTMLTextAreaElement =>
  screen.getByRole('textbox', { name: 'Message your planning buddy' })

describe('Composer', () => {
  it('has a labelled textarea with the default placeholder', () => {
    render(<Harness />)
    expect(box()).toHaveAttribute('placeholder', 'Paste learning objectives or ask for a change…')
    expect(box()).toHaveAttribute('rows', '2')
  })

  it('opens at the requested number of rows', () => {
    render(<Harness minRows={7} />)
    expect(box()).toHaveAttribute('rows', '7')
  })

  it('has the + button with menu semantics and a paperclip', () => {
    render(<Harness />)
    const plus = screen.getByRole('button', { name: 'Plugins' })
    expect(plus).toHaveAttribute('aria-haspopup', 'menu')
    expect(plus).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Attach a file' })).toBeInTheDocument()
  })

  it('reflects an open plugin menu in aria-expanded', () => {
    render(<Harness pluginsOpen />)
    expect(screen.getByRole('button', { name: 'Plugins' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('calls onPlus and onAttach', async () => {
    const onPlus = vi.fn()
    const onAttach = vi.fn()
    render(<Harness onPlus={onPlus} onAttach={onAttach} />)
    await userEvent.click(screen.getByRole('button', { name: 'Plugins' }))
    await userEvent.click(screen.getByRole('button', { name: 'Attach a file' }))
    expect(onPlus).toHaveBeenCalledTimes(1)
    expect(onAttach).toHaveBeenCalledTimes(1)
  })

  it('disables the paperclip once three files are staged', () => {
    const attachments = Array.from({ length: MAX_ATTACHMENTS }, (_, i) => ({
      id: String(i),
      name: `f${i}.pdf`
    }))
    render(<Harness attachments={attachments} />)
    expect(screen.getByRole('button', { name: 'Attach a file' })).toBeDisabled()
  })

  describe('Send', () => {
    it('is disabled while empty or only spaces, enabled with text', async () => {
      render(<Harness />)
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
      await userEvent.type(box(), '   ')
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
      await userEvent.type(box(), 'hello')
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    })

    it('sends on click', async () => {
      const onSend = vi.fn()
      render(<Harness initial="hi" onSend={onSend} />)
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      expect(onSend).toHaveBeenCalledTimes(1)
    })

    it('is enabled by a staged file alone, but not when regions are staged without text', () => {
      const attachments = [{ id: 'a', name: 'a.docx' }]
      const regions = [{ id: 'r', n: 1, slideNumber: 3 }]
      const { rerender } = render(<Harness attachments={attachments} />)
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
      rerender(<Harness attachments={attachments} regions={regions} />)
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    })

    it('is enabled by regions plus text', () => {
      render(<Harness initial="swap it" regions={[{ id: 'r', n: 1, slideNumber: 3 }]} />)
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    })

    it('can have another label', () => {
      render(<Harness initial="x" sendLabel="Ask" />)
      expect(screen.getByRole('button', { name: 'Ask' })).toBeInTheDocument()
    })
  })

  describe('keyboard', () => {
    it('Enter sends and does not add a line', async () => {
      const onSend = vi.fn()
      render(<Harness initial="hi" onSend={onSend} />)
      box().focus()
      await userEvent.keyboard('{Enter}')
      expect(onSend).toHaveBeenCalledTimes(1)
      expect(box().value).toBe('hi')
    })

    it('Shift+Enter adds a new line and does not send', async () => {
      const onSend = vi.fn()
      render(<Harness initial="hi" onSend={onSend} />)
      await userEvent.type(box(), '{Shift>}{Enter}{/Shift}there')
      expect(onSend).not.toHaveBeenCalled()
      expect(box().value).toBe('hi\nthere')
    })

    it('Ctrl+Enter sends', async () => {
      const onSend = vi.fn()
      render(<Harness initial="hi" onSend={onSend} />)
      box().focus()
      await userEvent.keyboard('{Control>}{Enter}{/Control}')
      expect(onSend).toHaveBeenCalledTimes(1)
    })

    it('does not send an empty message with Enter, nor insert a line', async () => {
      const onSend = vi.fn()
      render(<Harness onSend={onSend} />)
      box().focus()
      await userEvent.keyboard('{Enter}')
      expect(onSend).not.toHaveBeenCalled()
      expect(box().value).toBe('')
    })

    it('does not send while an input method is composing', () => {
      const onSend = vi.fn()
      render(<Harness initial="こん" onSend={onSend} />)
      fireEvent.keyDown(box(), { key: 'Enter', isComposing: true })
      expect(onSend).not.toHaveBeenCalled()
    })

    it('in generate mode Enter adds a new line and Ctrl+Enter sends', async () => {
      const onSend = vi.fn()
      render(<Harness mode="generate" onSend={onSend} />)
      await userEvent.type(box(), 'LO1{Enter}LO2')
      expect(onSend).not.toHaveBeenCalled()
      expect(box().value).toBe('LO1\nLO2')
      await userEvent.keyboard('{Control>}{Enter}{/Control}')
      expect(onSend).toHaveBeenCalledTimes(1)
    })

    it('enterSends can override the mode default', async () => {
      const onSend = vi.fn()
      render(<Harness mode="generate" enterSends initial="x" onSend={onSend} />)
      box().focus()
      await userEvent.keyboard('{Enter}')
      expect(onSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('generate mode', () => {
    it('shows "Make my slides" instead of Send', () => {
      render(<Harness mode="generate" initial="LO1" />)
      expect(screen.getByRole('button', { name: 'Make my slides' })).toBeEnabled()
      expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
    })

    it('is disabled while empty and sends on click', async () => {
      const onSend = vi.fn()
      const { rerender } = render(<Harness mode="generate" onSend={onSend} />)
      expect(screen.getByRole('button', { name: 'Make my slides' })).toBeDisabled()
      rerender(<Harness key="filled" mode="generate" initial="x" onSend={onSend} />)
      await userEvent.click(screen.getByRole('button', { name: 'Make my slides' }))
      expect(onSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('busy', () => {
    it('replaces Send with Stop, which calls onStop', async () => {
      const onStop = vi.fn()
      render(<Harness busy initial="hi" onStop={onStop} />)
      expect(screen.queryByRole('button', { name: 'Send' })).toBeNull()
      await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
      expect(onStop).toHaveBeenCalledTimes(1)
    })

    it('ignores Enter and Ctrl+Enter while busy but still accepts typing', async () => {
      const onSend = vi.fn()
      render(<Harness busy initial="hi" onSend={onSend} />)
      box().focus()
      await userEvent.keyboard('{Control>}{Enter}{/Control}{Enter}')
      expect(onSend).not.toHaveBeenCalled()
      await userEvent.type(box(), '!')
      expect(box().value).toBe('hi!')
    })
  })

  describe('disabled (no key)', () => {
    it('locks the textarea and every button and explains why', () => {
      render(<Harness disabled initial="hi" />)
      expect(box()).toBeDisabled()
      expect(box()).toHaveAttribute('placeholder', 'Connect Claude to start chatting')
      expect(screen.getByRole('button', { name: 'Plugins' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Attach a file' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    })
  })

  describe('placeholder', () => {
    it('asks what to change in the circled area when regions are staged', () => {
      render(<Harness regions={[{ id: 'r', n: 1, slideNumber: 3 }]} />)
      expect(box()).toHaveAttribute('placeholder', 'Say what to change in the circled area…')
    })

    it('can be overridden', () => {
      render(<Harness placeholder="e.g. Photosynthesis" />)
      expect(box()).toHaveAttribute('placeholder', 'e.g. Photosynthesis')
    })
  })

  describe('staged items', () => {
    it('removes a staged file and a staged region by id', async () => {
      const onRemoveAttachment = vi.fn()
      const onRemoveRegion = vi.fn()
      render(
        <Harness
          attachments={[{ id: 'a1', name: 'LOs.docx' }]}
          regions={[{ id: 'r1', n: 1, slideNumber: 3 }]}
          onRemoveAttachment={onRemoveAttachment}
          onRemoveRegion={onRemoveRegion}
        />
      )
      await userEvent.click(screen.getByRole('button', { name: 'Remove LOs.docx' }))
      await userEvent.click(screen.getByRole('button', { name: 'Remove region 1' }))
      expect(onRemoveAttachment).toHaveBeenCalledWith('a1')
      expect(onRemoveRegion).toHaveBeenCalledWith('r1')
    })

    it('reports which region chip is hovered, then null', async () => {
      const onHighlightRegion = vi.fn()
      render(
        <Harness
          regions={[{ id: 'r1', n: 1, slideNumber: 3, onClick: () => {} }]}
          onHighlightRegion={onHighlightRegion}
        />
      )
      const chip = screen.getByRole('button', { name: 'Region 1 on slide 3' })
      await userEvent.hover(chip)
      expect(onHighlightRegion).toHaveBeenLastCalledWith('r1')
      await userEvent.unhover(chip)
      expect(onHighlightRegion).toHaveBeenLastCalledWith(null)
    })

    it('shows no staged row when nothing is staged', () => {
      const { container } = render(<Harness />)
      expect(container.querySelector('.ui-composer__staged')).toBeNull()
    })
  })

  describe('pasting files', () => {
    it('hands pasted files to onPasteFiles instead of the textarea', () => {
      const onPasteFiles = vi.fn()
      render(<Harness onPasteFiles={onPasteFiles} />)
      const file = new File(['x'], 'leaf.png', { type: 'image/png' })
      fireEvent.paste(box(), { clipboardData: { files: [file] } })
      expect(onPasteFiles).toHaveBeenCalledWith([file])
    })

    it('lets plain text paste through', () => {
      const onPasteFiles = vi.fn()
      render(<Harness onPasteFiles={onPasteFiles} />)
      fireEvent.paste(box(), { clipboardData: { files: [] } })
      expect(onPasteFiles).not.toHaveBeenCalled()
    })
  })

  it('hands the textarea to textareaRef so a screen can focus it', () => {
    const ref = { current: null as HTMLTextAreaElement | null }
    render(<Harness textareaRef={ref} />)
    expect(ref.current).toBe(box())
  })

  it('grows with its content', () => {
    render(<Harness initial="line" />)
    Object.defineProperty(box(), 'scrollHeight', { configurable: true, value: 120 })
    fireEvent.change(box(), { target: { value: 'line\nline\nline' } })
    expect(box().style.height).toBe('120px')
  })
})
