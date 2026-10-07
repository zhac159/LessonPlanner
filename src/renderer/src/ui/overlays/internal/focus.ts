import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Tabbable descendants of `root`, in DOM order. */
export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true'
  )
}

/**
 * While `active`: move focus into `container` (to `[data-autofocus]`, else the first tabbable,
 * else the container), keep Tab inside it when `trap` is set, and on cleanup give focus back to
 * whatever had it before. This is what makes dialogs and menus keyboard-friendly.
 */
export function useFocusScope(
  container: RefObject<HTMLElement | null>,
  active: boolean,
  options: { trap?: boolean; prefer?: string } = {}
): void {
  const { trap = false, prefer } = options
  useEffect(() => {
    const root = container.current
    if (!active || !root) return
    const previous = document.activeElement as HTMLElement | null
    const preferred = prefer ? root.querySelector<HTMLElement>(prefer) : null
    const initial =
      root.querySelector<HTMLElement>('[data-autofocus]') ??
      (preferred ? focusableIn(preferred)[0] : undefined) ??
      focusableIn(root)[0] ??
      root
    initial.focus()

    const onKeyDown = (event: KeyboardEvent): void => {
      if (!trap || event.key !== 'Tab') return
      const items = focusableIn(root)
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]!
      const last = items[items.length - 1]!
      const current = document.activeElement
      if (event.shiftKey && (current === first || !root.contains(current))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (current === last || !root.contains(current))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previous && previous.isConnected) previous.focus()
    }
  }, [container, active, trap, prefer])
}

/** Call `onEscape` when Escape is pressed and nothing else (a nested menu) has handled it. */
export function useEscape(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) onEscape()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, onEscape])
}
