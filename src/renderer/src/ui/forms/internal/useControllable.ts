import { useCallback, useRef, useState } from 'react'

/**
 * State that is controlled when `value` is defined and uncontrolled otherwise.
 * Returns the current value and a setter that always calls `onChange` (only when the value changes).
 */
export function useControllable<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void
): [T, (next: T) => void] {
  const [inner, setInner] = useState<T>(defaultValue)
  const controlled = value !== undefined
  const current = controlled ? value : inner
  const latest = useRef({ current, controlled, onChange })
  latest.current = { current, controlled, onChange }

  const set = useCallback((next: T) => {
    const { current: now, controlled: isControlled, onChange: notify } = latest.current
    if (Object.is(next, now)) return
    if (!isControlled) setInner(next)
    notify?.(next)
  }, [])

  return [current, set]
}
