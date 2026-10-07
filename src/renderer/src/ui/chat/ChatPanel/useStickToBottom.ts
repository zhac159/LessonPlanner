import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** How far from the bottom (px) still counts as "following the conversation". */
export const NEAR_BOTTOM_PX = 80

export interface StickToBottom<T extends HTMLElement> {
  ref: RefObject<T | null>
  /** Attach to the scroll container's `onScroll`. */
  onScroll: () => void
  /** She has scrolled up: new content no longer pulls her down. */
  away: boolean
  /** Scroll to the newest content and follow it again. */
  jump: () => void
}

/**
 * Keep a scroll container pinned to its newest content, unless the reader has scrolled up by
 * more than `NEAR_BOTTOM_PX`. Follows both React re-renders and DOM growth inside the container.
 */
export function useStickToBottom<T extends HTMLElement>(): StickToBottom<T> {
  const ref = useRef<T | null>(null)
  const stuck = useRef(true)
  const [away, setAway] = useState(false)

  const toBottom = useCallback((): void => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  const onScroll = useCallback((): void => {
    const el = ref.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
    stuck.current = near
    setAway(!near)
  }, [])

  const jump = useCallback((): void => {
    stuck.current = true
    setAway(false)
    toBottom()
  }, [toBottom])

  // After every render of the panel, follow the newest content.
  useLayoutEffect(() => {
    if (stuck.current) toBottom()
  })

  // Text can grow inside a child without the panel re-rendering (streaming, images loading).
  useEffect(() => {
    const el = ref.current
    if (!el || typeof MutationObserver === 'undefined') return undefined
    const observer = new MutationObserver(() => {
      if (stuck.current) toBottom()
    })
    observer.observe(el, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [toBottom])

  return { ref, onScroll, away, jump }
}
