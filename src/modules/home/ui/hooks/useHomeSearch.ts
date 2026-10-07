import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'

export const SEARCH_DEBOUNCE_MS = 150

export interface HomeSearch {
  /** What is in the box right now. */
  value: string
  /** The value lists filter by: `value` after a 150 ms pause. */
  query: string
  inputRef: RefObject<HTMLInputElement | null>
  setValue(value: string): void
  /** Empties the box at once (no debounce). */
  clear(): void
  /** Esc clears the box; Esc in an empty box leaves it. */
  onKeyDown(event: KeyboardEvent<HTMLInputElement>): void
}

/**
 * The page search: debounced query, Ctrl+F focuses it while Home is visible, Esc clears it
 * (and blurs when already empty), 03 §8.
 */
export function useHomeSearch(active: boolean): HomeSearch {
  const [value, setValueState] = useState('')
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (value === query) return
    const timer = setTimeout(() => setQuery(value), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [value, query])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'f')
        return
      event.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])

  const clear = useCallback(() => {
    setValueState('')
    setQuery('')
  }, [])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Escape') return
      if (event.currentTarget.value === '') event.currentTarget.blur()
      else clear()
    },
    [clear]
  )

  return { value, query, inputRef, setValue: setValueState, clear, onKeyDown }
}
