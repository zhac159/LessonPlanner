import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ToolRail, type ToolRailProps } from './ToolRail'

function setup(props: Partial<ToolRailProps> = {}) {
  const handlers = {
    onToolChange: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn()
  }
  const user = userEvent.setup()
  const utils = render(
    <>
      <ToolRail tool="select" canUndo canRedo {...handlers} {...props} />
      <input aria-label="Notes" />
    </>
  )
  return { user, ...handlers, ...utils }
}

describe('ToolRail', () => {
  it('is a vertical toolbar named "Canvas tools"', () => {
    setup()
    const bar = screen.getByRole('toolbar', { name: 'Canvas tools' })
    expect(bar).toHaveAttribute('aria-orientation', 'vertical')
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Select',
      'Circle to edit',
      'Draw',
      'Text',
      'Sticky note',
      'Undo',
      'Redo'
    ])
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('can be horizontal', () => {
    setup({ orientation: 'horizontal' })
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-orientation', 'horizontal')
  })

  it('marks only the active tool as pressed', () => {
    setup({ tool: 'circle' })
    expect(screen.getByRole('button', { name: 'Circle to edit' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Undo' })).not.toHaveAttribute('aria-pressed')
  })

  it('picks a tool by click', async () => {
    const { user, onToolChange } = setup()
    await user.click(screen.getByRole('button', { name: 'Text' }))
    expect(onToolChange).toHaveBeenCalledWith('text')
  })

  it('runs undo and redo by click', async () => {
    const { user, onUndo, onRedo } = setup()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onRedo).toHaveBeenCalledTimes(1)
  })

  it('disables undo and redo when there is nothing to do', async () => {
    const { user, onUndo, onRedo } = setup({ canUndo: false, canRedo: false })
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveAttribute('aria-disabled', 'true')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(onUndo).not.toHaveBeenCalled()
    expect(onRedo).not.toHaveBeenCalled()
  })

  describe('roving focus', () => {
    it('has one tab stop: the active tool', () => {
      setup({ tool: 'draw' })
      const stops = screen.getAllByRole('button').filter((b) => b.tabIndex === 0)
      expect(stops.map((b) => b.getAttribute('aria-label'))).toEqual(['Draw'])
    })

    it('moves with the arrow keys, wrapping, and with Home and End', async () => {
      const { user } = setup()
      await user.tab()
      expect(screen.getByRole('button', { name: 'Select' })).toHaveFocus()
      await user.keyboard('{ArrowDown}')
      expect(screen.getByRole('button', { name: 'Circle to edit' })).toHaveFocus()
      await user.keyboard('{End}')
      expect(screen.getByRole('button', { name: 'Redo' })).toHaveFocus()
      await user.keyboard('{ArrowDown}')
      expect(screen.getByRole('button', { name: 'Select' })).toHaveFocus()
      await user.keyboard('{ArrowUp}')
      expect(screen.getByRole('button', { name: 'Redo' })).toHaveFocus()
      await user.keyboard('{Home}')
      expect(screen.getByRole('button', { name: 'Select' })).toHaveFocus()
    })

    it('uses left and right arrows when horizontal', async () => {
      const { user } = setup({ orientation: 'horizontal' })
      await user.tab()
      await user.keyboard('{ArrowRight}')
      expect(screen.getByRole('button', { name: 'Circle to edit' })).toHaveFocus()
    })

    it('keeps the tab stop where focus left and Tab leaves the rail', async () => {
      const { user } = setup()
      await user.tab()
      await user.keyboard('{ArrowDown}{ArrowDown}')
      await user.tab()
      expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveFocus()
      await user.tab({ shift: true })
      expect(screen.getByRole('button', { name: 'Select' })).toHaveFocus()
    })

    it('returns to Select with Esc inside the rail, but not when already on Select', async () => {
      const { user, onToolChange, rerender, onUndo, onRedo } = setup({ tool: 'circle' })
      await user.tab()
      await user.keyboard('{Escape}')
      expect(onToolChange).toHaveBeenCalledWith('select')
      onToolChange.mockClear()
      rerender(
        <ToolRail
          tool="select"
          canUndo
          canRedo
          onToolChange={onToolChange}
          onUndo={onUndo}
          onRedo={onRedo}
        />
      )
      await user.keyboard('{Escape}')
      expect(onToolChange).not.toHaveBeenCalled()
    })
  })

  describe('shortcuts', () => {
    it('picks tools with single keys', async () => {
      const { user, onToolChange } = setup()
      await user.keyboard('c')
      await user.keyboard('n')
      expect(onToolChange.mock.calls).toEqual([['circle'], ['note']])
    })

    it('undoes and redoes with Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z', async () => {
      const { user, onUndo, onRedo } = setup()
      await user.keyboard('{Control>}z{/Control}')
      await user.keyboard('{Control>}y{/Control}')
      await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
      expect(onUndo).toHaveBeenCalledTimes(1)
      expect(onRedo).toHaveBeenCalledTimes(2)
    })

    it('does not undo when there is nothing to undo', async () => {
      const { user, onUndo } = setup({ canUndo: false })
      await user.keyboard('{Control>}z{/Control}')
      expect(onUndo).not.toHaveBeenCalled()
    })

    it('stays quiet while typing in a text field', async () => {
      const { user, onToolChange, onUndo } = setup()
      await user.click(screen.getByRole('textbox', { name: 'Notes' }))
      await user.keyboard('cvd{Control>}z{/Control}')
      expect(onToolChange).not.toHaveBeenCalled()
      expect(onUndo).not.toHaveBeenCalled()
    })

    it('can be switched off', async () => {
      const { user, onToolChange } = setup({ shortcuts: false })
      await user.keyboard('c')
      expect(onToolChange).not.toHaveBeenCalled()
    })
  })
})
