import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '../../atoms/cx'
import { ToolButton } from '../ToolButton/ToolButton'
import { isTextEntry, movedFocusIndex, shortcutFor } from './shortcuts'
import {
  ariaShortcutFor,
  CANVAS_TOOLS,
  HISTORY_ACTIONS,
  tooltipFor,
  type EditorAction,
  type EditorTool,
  type ToolDefinition
} from './tools'
import './ToolRail.css'

export interface ToolRailProps {
  /** The active tool. */
  tool: EditorTool
  onToolChange: (tool: EditorTool) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  /** Vertical beside the stage, horizontal when the window is narrow (06 §6.4). */
  orientation?: 'vertical' | 'horizontal'
  /** Listen for V C D T N, Ctrl+Z and Ctrl+Y on the document (never while typing in a field). */
  shortcuts?: boolean
  className?: string
}

interface RailItem {
  def: ToolDefinition<EditorTool | EditorAction>
  isTool: boolean
  /** Undo and redo sit after the divider. */
  separatorBefore: boolean
}

const ITEMS: RailItem[] = [
  ...CANVAS_TOOLS.map((def) => ({ def, isTool: true, separatorBefore: false })),
  ...HISTORY_ACTIONS.map((def, index) => ({ def, isTool: false, separatorBefore: index === 0 }))
]

/**
 * The canvas tool rail (design-system: ToolRail). A toolbar with roving focus (arrows, Home,
 * End), one pressed tool, Undo and Redo, and the editor's single-key shortcuts. Esc inside the
 * rail returns to Select.
 */
export function ToolRail({
  tool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  orientation = 'vertical',
  shortcuts = true,
  className
}: ToolRailProps) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  /** The button that holds the roving tab stop while focus is inside the rail. */
  const [focused, setFocused] = useState<string | null>(null)
  const latest = useRef({ onToolChange, onUndo, onRedo, canUndo, canRedo })
  latest.current = { onToolChange, onUndo, onRedo, canUndo, canRedo }

  useEffect(() => {
    if (!shortcuts) return
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.defaultPrevented || isTextEntry(event.target)) return
      const action = shortcutFor(event)
      if (!action) return
      const now = latest.current
      if (action.kind === 'tool') now.onToolChange(action.tool)
      else if (action.action === 'undo' && now.canUndo) now.onUndo()
      else if (action.action === 'redo' && now.canRedo) now.onRedo()
      else return
      event.preventDefault()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [shortcuts])

  // Captured, because an open tooltip swallows Esc in the bubbling phase.
  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && tool !== 'select') onToolChange('select')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const current = document.activeElement?.getAttribute('data-id')
    const from = ITEMS.findIndex((item) => item.def.id === current)
    const to = movedFocusIndex(event.key, Math.max(from, 0), ITEMS.length, orientation)
    if (to === null) return
    event.preventDefault()
    buttons.current.get(ITEMS[to].def.id)?.focus()
  }

  const stop = focused ?? tool
  const isDisabled = (id: string): boolean => (id === 'undo' ? !canUndo : id === 'redo' && !canRedo)

  return (
    <div
      role="toolbar"
      aria-label="Canvas tools"
      aria-orientation={orientation}
      className={cx('tool-rail', className)}
      data-orientation={orientation}
      onKeyDownCapture={onKeyDownCapture}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null)
      }}
    >
      {ITEMS.map(({ def, isTool, separatorBefore }) => (
        <Fragment key={def.id}>
          {separatorBefore && (
            <span
              role="separator"
              aria-orientation={orientation === 'vertical' ? 'horizontal' : 'vertical'}
              className="tool-rail__divider"
            />
          )}
          <ToolButton
            ref={(node) => {
              if (node) buttons.current.set(def.id, node)
              else buttons.current.delete(def.id)
            }}
            data-id={def.id}
            label={def.label}
            tooltip={tooltipFor(def)}
            icon={def.icon}
            pressed={isTool ? tool === def.id : undefined}
            disabled={isDisabled(def.id)}
            tabIndex={stop === def.id ? 0 : -1}
            aria-keyshortcuts={ariaShortcutFor(def)}
            onFocus={() => setFocused(def.id)}
            onClick={() => {
              if (isTool) onToolChange(def.id as EditorTool)
              else if (def.id === 'undo') onUndo()
              else onRedo()
            }}
          />
        </Fragment>
      ))}
    </div>
  )
}
