import { useCallback, useRef } from 'react'

/** Where focus goes when a sheet closes: back to what had it when the sheet opened, else to a fallback. */
export function useReturnFocus() {
  const from = useRef<HTMLElement | null>(null)
  const remember = useCallback((): void => {
    const active = document.activeElement
    from.current = active instanceof HTMLElement && active !== document.body ? active : null
  }, [])
  const restore = useCallback((fallback?: () => HTMLElement | null): void => {
    const target = from.current?.isConnected ? from.current : (fallback?.() ?? null)
    from.current = null
    // After the sheet has left the DOM, so the browser does not hand focus to the body first.
    queueMicrotask(() => target?.focus())
  }, [])
  return { remember, restore }
}

/** The Composer's box, the last resort for focus after a sheet. */
export const composerBox = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.ui-composer__input')
