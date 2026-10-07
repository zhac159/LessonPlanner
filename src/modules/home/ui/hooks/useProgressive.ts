import { useCallback, useEffect, useRef, useState } from 'react'

export const LESSON_PAGE = 48

/**
 * Renders long lists in pages (03 §7 "first 48, more on scroll"): `count` grows by `step` when the
 * sentinel scrolls into view or `showMore` is called, and starts again when `resetKey` changes.
 */
export function useProgressive(total: number, resetKey: string, step = LESSON_PAGE) {
  const [state, setState] = useState({ key: resetKey, count: step })
  const sentinel = useRef<HTMLDivElement | null>(null)
  const count = state.key === resetKey ? state.count : step
  const more = count < total

  const showMore = useCallback(
    () =>
      setState((current) => ({
        key: resetKey,
        count: (current.key === resetKey ? current.count : step) + step
      })),
    [resetKey, step]
  )

  useEffect(() => {
    const node = sentinel.current
    if (!more || !node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) showMore()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [more, count, showMore])

  return { count, more, showMore, sentinel }
}
