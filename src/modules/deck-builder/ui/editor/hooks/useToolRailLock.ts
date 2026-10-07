import { useEffect, type RefObject } from 'react'

/**
 * Marks tools of the ToolRail as unavailable (`aria-disabled`, `data-locked`) while the stage is view-only (06 §7).
 * The kit has no per-tool disabled state, so the buttons are found by their `data-id` and the screen also ignores
 * clicks and shortcuts for locked tools.
 */
export function useToolRailLock(
  rail: RefObject<HTMLElement | null>,
  locked: readonly string[]
): void {
  const key = locked.join(',')
  useEffect(() => {
    const root = rail.current
    if (!root) return
    const wanted = new Set(key ? key.split(',') : [])
    root.querySelectorAll<HTMLElement>('button[data-id]').forEach((button) => {
      if (wanted.has(button.dataset.id ?? '')) {
        button.setAttribute('aria-disabled', 'true')
        button.setAttribute('data-locked', '')
      } else if (button.hasAttribute('data-locked')) {
        button.removeAttribute('aria-disabled')
        button.removeAttribute('data-locked')
      }
    })
  }, [rail, key])
}
