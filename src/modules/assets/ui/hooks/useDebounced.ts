import { useEffect, useState } from 'react'

/** `value`, but only after it has stayed the same for `delayMs` (the search box, the live name check). */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    if (Object.is(value, settled)) return
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, settled, delayMs])
  return settled
}
