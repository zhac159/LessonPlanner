import { useEffect, useState } from 'react'

/** The current time, refreshed every minute and when Home becomes visible (greeting, "Today"). */
export function useNow(active: boolean, everyMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(timer)
  }, [active, everyMs])
  return now
}
