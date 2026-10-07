import { useEffect } from 'react'
import type { NavIntent } from './types'

interface Shortcut {
  key: string
  moduleId: string
  intent: NavIntent
}

/** design/screens/README.md "Global keyboard shortcuts". Esc belongs to the components that own a layer. */
const SHORTCUTS: ReadonlyArray<Shortcut> = [
  { key: 'n', moduleId: 'deck-builder', intent: { kind: 'new-lesson' } },
  { key: ',', moduleId: 'settings', intent: { kind: 'ai' } }
]

/** Ctrl+N (new lesson) and Ctrl+, (Settings > AI) anywhere, while `enabled` (i.e. not in first run). */
export function useGlobalShortcuts(
  enabled: boolean,
  navigate: (id: string, intent?: NavIntent) => void
): void {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
      const shortcut = SHORTCUTS.find((s) => s.key === event.key.toLowerCase())
      if (!shortcut) return
      event.preventDefault()
      navigate(shortcut.moduleId, shortcut.intent)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, navigate])
}
