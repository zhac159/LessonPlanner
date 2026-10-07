import { describe, expect, it } from 'vitest'
import { movedFocusIndex, shortcutFor, type KeyLike } from './shortcuts'

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods
})

describe('shortcutFor', () => {
  it.each([
    ['v', 'select'],
    ['c', 'circle'],
    ['d', 'draw'],
    ['t', 'text'],
    ['n', 'note']
  ])('%s picks the %s tool', (letter, tool) => {
    expect(shortcutFor(key(letter))).toEqual({ kind: 'tool', tool })
  })

  it('ignores letter case from Caps Lock', () => {
    expect(shortcutFor(key('C'))).toEqual({ kind: 'tool', tool: 'circle' })
  })

  it('undoes with Ctrl+Z and Cmd+Z', () => {
    expect(shortcutFor(key('z', { ctrlKey: true }))).toEqual({ kind: 'history', action: 'undo' })
    expect(shortcutFor(key('z', { metaKey: true }))).toEqual({ kind: 'history', action: 'undo' })
  })

  it('redoes with Ctrl+Y and Ctrl+Shift+Z', () => {
    expect(shortcutFor(key('y', { ctrlKey: true }))).toEqual({ kind: 'history', action: 'redo' })
    expect(shortcutFor(key('Z', { ctrlKey: true, shiftKey: true }))).toEqual({
      kind: 'history',
      action: 'redo'
    })
  })

  it('does not treat modified or unknown keys as tools', () => {
    expect(shortcutFor(key('c', { ctrlKey: true }))).toBeNull()
    expect(shortcutFor(key('c', { altKey: true }))).toBeNull()
    expect(shortcutFor(key('c', { shiftKey: true }))).toBeNull()
    expect(shortcutFor(key('y', { ctrlKey: true, shiftKey: true }))).toBeNull()
    expect(shortcutFor(key('q'))).toBeNull()
    expect(shortcutFor(key('Escape'))).toBeNull()
  })
})

describe('movedFocusIndex', () => {
  it('moves along the vertical axis and wraps', () => {
    expect(movedFocusIndex('ArrowDown', 0, 7, 'vertical')).toBe(1)
    expect(movedFocusIndex('ArrowDown', 6, 7, 'vertical')).toBe(0)
    expect(movedFocusIndex('ArrowUp', 0, 7, 'vertical')).toBe(6)
  })

  it('moves along the horizontal axis when the rail is horizontal', () => {
    expect(movedFocusIndex('ArrowRight', 2, 7, 'horizontal')).toBe(3)
    expect(movedFocusIndex('ArrowLeft', 0, 7, 'horizontal')).toBe(6)
    expect(movedFocusIndex('ArrowDown', 2, 7, 'horizontal')).toBeNull()
  })

  it('jumps with Home and End and ignores other keys or empty rails', () => {
    expect(movedFocusIndex('Home', 4, 7, 'vertical')).toBe(0)
    expect(movedFocusIndex('End', 1, 7, 'vertical')).toBe(6)
    expect(movedFocusIndex('a', 1, 7, 'vertical')).toBeNull()
    expect(movedFocusIndex('Home', 0, 0, 'vertical')).toBeNull()
  })
})
