import { useEffect, useState } from 'react'

/** Below this window width the two cards stack and the file list is shortened (04 §3). */
export const STACK_QUERY = '(max-width: 1249px)'

const read = (query: string): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false

/** True while the window matches `query` (false where matchMedia does not exist, e.g. tests). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => read(query))
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const list = window.matchMedia(query)
    const update = (): void => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])
  return matches
}
