import { CANVAS_TOOLS, type EditorAction, type EditorTool } from './tools'

/** What a key press asks the rail to do. */
export type ShortcutAction =
  { kind: 'tool'; tool: EditorTool } | { kind: 'history'; action: EditorAction }

export interface KeyLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

const TOOL_BY_KEY = new Map(CANVAS_TOOLS.map((tool) => [tool.key, tool.id]))

/**
 * Maps a key press to a rail action: V C D T N pick a tool, Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z
 * redo (Cmd counts as Ctrl). Returns null for everything else, including modified letters.
 */
export function shortcutFor(event: KeyLike): ShortcutAction | null {
  const key = event.key.toLowerCase()
  if (event.altKey) return null
  const command = event.ctrlKey || event.metaKey
  if (command) {
    if (key === 'z') return { kind: 'history', action: event.shiftKey ? 'redo' : 'undo' }
    if (key === 'y' && !event.shiftKey) return { kind: 'history', action: 'redo' }
    return null
  }
  if (event.shiftKey) return null
  const tool = TOOL_BY_KEY.get(key)
  return tool ? { kind: 'tool', tool } : null
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])

/** The few element properties `isTextEntry` reads (keeps this file free of DOM globals). */
interface FieldLike {
  tagName?: string
  isContentEditable?: boolean
  type?: string
}

/** True when typing here means text: single-key shortcuts and Ctrl+Z must be left to the field. */
export function isTextEntry(target: EventTarget | null): boolean {
  const el = target as FieldLike | null
  if (!el) return false
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
  return el.tagName === 'INPUT' && TEXT_INPUT_TYPES.has(el.type ?? 'text')
}

/**
 * Index to focus after `key` inside a roving-focus toolbar (arrows along its axis, Home, End),
 * wrapping at the ends. Null when the key does not move focus.
 */
export function movedFocusIndex(
  key: string,
  index: number,
  count: number,
  orientation: 'vertical' | 'horizontal'
): number | null {
  if (count <= 0) return null
  const [back, forward] =
    orientation === 'vertical' ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight']
  if (key === forward) return (index + 1) % count
  if (key === back) return (index - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}
