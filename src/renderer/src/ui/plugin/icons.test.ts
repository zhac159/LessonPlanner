import { Puzzle, Timer } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { isPluginIcon, pluginIcon } from './icons'

describe('pluginIcon', () => {
  it.each(['list-checks', 'users', 'file-text', 'notebook-text', 'timer', 'plus'])(
    'knows the planned plugin icon %s',
    (name) => {
      expect(isPluginIcon(name)).toBe(true)
      expect(pluginIcon(name)).not.toBe(Puzzle)
    }
  )

  it('returns the matching lucide icon', () => {
    expect(pluginIcon('timer')).toBe(Timer)
  })

  it('falls back to a puzzle piece for unknown names', () => {
    expect(pluginIcon('does-not-exist')).toBe(Puzzle)
    expect(isPluginIcon('does-not-exist')).toBe(false)
    expect(pluginIcon('')).toBe(Puzzle)
  })

  it('does not treat inherited object keys as icons', () => {
    expect(pluginIcon('constructor')).toBe(Puzzle)
  })
})
