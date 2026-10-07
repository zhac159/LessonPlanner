import { describe, expect, it } from 'vitest'
import { ariaShortcutFor, CANVAS_TOOLS, HISTORY_ACTIONS, tooltipFor } from './tools'

describe('tool definitions', () => {
  it('lists the five canvas tools in rail order', () => {
    expect(CANVAS_TOOLS.map((t) => t.id)).toEqual(['select', 'circle', 'draw', 'text', 'note'])
  })

  it('lists undo then redo', () => {
    expect(HISTORY_ACTIONS.map((a) => a.id)).toEqual(['undo', 'redo'])
  })

  it('gives every tool a unique single-key shortcut', () => {
    const keys = CANVAS_TOOLS.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) expect(key).toMatch(/^[a-z]$/)
  })
})

describe('tooltipFor', () => {
  it('appends the upper-case key', () => {
    expect(tooltipFor(CANVAS_TOOLS[1])).toBe('Circle to edit (C)')
  })

  it('appends a chord hint for history actions', () => {
    expect(tooltipFor(HISTORY_ACTIONS[0])).toBe('Undo (Ctrl+Z)')
    expect(tooltipFor(HISTORY_ACTIONS[1])).toBe('Redo (Ctrl+Y)')
  })
})

describe('ariaShortcutFor', () => {
  it('describes keys and chords for assistive technology', () => {
    expect(ariaShortcutFor(CANVAS_TOOLS[0])).toBe('V')
    expect(ariaShortcutFor(HISTORY_ACTIONS[0])).toBe('Control+Z')
    expect(ariaShortcutFor(HISTORY_ACTIONS[1])).toBe('Control+Y Control+Shift+Z')
  })
})
