import { useEffect, useState } from 'react'

/** True once `flag` has been true for `delayMs` without a break; false at once when it turns false. */
export function useDelayedFlag(flag: boolean, delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(false)
  useEffect(() => {
    if (!flag) {
      setElapsed(false)
      return
    }
    const timer = setTimeout(() => setElapsed(true), delayMs)
    return () => clearTimeout(timer)
  }, [flag, delayMs])
  return flag && elapsed
}
