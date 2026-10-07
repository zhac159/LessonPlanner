import { useEffect, useState } from 'react'

const isOnline = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine)

/** Whether the computer has a network connection (the "Offline" pill shows when it has not). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline)
  useEffect(() => {
    const update = (): void => setOnline(isOnline())
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
