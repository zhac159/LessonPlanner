import {
  Lasso,
  MousePointer2,
  PenLine,
  Redo2,
  StickyNote,
  Type,
  Undo2,
  type LucideIcon
} from 'lucide-react'

/** The canvas tools of the lesson editor (06 §8.2). Exactly one is active at a time. */
export type EditorTool = 'select' | 'circle' | 'draw' | 'text' | 'note'

/** Buttons of the rail that act once instead of switching tool. */
export type EditorAction = 'undo' | 'redo'

export interface ToolDefinition<Id extends string = string> {
  id: Id
  /** Visible in the tooltip and the accessible name. */
  label: string
  /** Single-key shortcut (tools), shown as "(V)" in the tooltip. */
  key?: string
  /** Text of the shortcut hint when it is not a single key ("Ctrl+Z"). */
  hint?: string
  icon: LucideIcon
}

/** Tools in rail order (design-system: ToolRail). */
export const CANVAS_TOOLS: ReadonlyArray<ToolDefinition<EditorTool>> = [
  { id: 'select', label: 'Select', key: 'v', icon: MousePointer2 },
  { id: 'circle', label: 'Circle to edit', key: 'c', icon: Lasso },
  { id: 'draw', label: 'Draw', key: 'd', icon: PenLine },
  { id: 'text', label: 'Text', key: 't', icon: Type },
  { id: 'note', label: 'Sticky note', key: 'n', icon: StickyNote }
]

/** Undo and redo, below the divider. */
export const HISTORY_ACTIONS: ReadonlyArray<ToolDefinition<EditorAction>> = [
  { id: 'undo', label: 'Undo', hint: 'Ctrl+Z', icon: Undo2 },
  { id: 'redo', label: 'Redo', hint: 'Ctrl+Y', icon: Redo2 }
]

/** Tooltip text: "Circle to edit (C)", "Undo (Ctrl+Z)". */
export function tooltipFor(def: ToolDefinition): string {
  const shortcut = def.hint ?? def.key?.toUpperCase()
  return shortcut ? `${def.label} (${shortcut})` : def.label
}

/** What the `aria-keyshortcuts` attribute should say for a definition. */
export function ariaShortcutFor(def: ToolDefinition): string | undefined {
  if (def.id === 'redo') return 'Control+Y Control+Shift+Z'
  if (def.id === 'undo') return 'Control+Z'
  return def.key?.toUpperCase()
}
