import { useEffect, useRef } from 'react'

export interface EditorShortcutHandlers {
  /** Ctrl+E */
  onExport(): void
  /** F5: the show from slide 1. */
  onPresentFromStart(): void
  /** Shift+F5: the show from the slide on the stage. */
  onPresentFromCurrent(): void
}

/**
 * The editor's document-wide shortcuts that are not part of the ToolRail (06 §8.11, §8.12, README "Global keyboard
 * shortcuts"). `enabled` is false while another module is showing or the slide show is up. Letter keys and undo live in
 * the ToolRail kit; stage keys (arrows, Delete, Esc) live on the stage itself.
 */
export function useEditorShortcuts(enabled: boolean, handlers: EditorShortcutHandlers): void {
  const latest = useRef(handlers)
  latest.current = handlers

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        latest.current.onExport()
      } else if (event.key === 'F5' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        if (event.shiftKey) latest.current.onPresentFromCurrent()
        else latest.current.onPresentFromStart()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
