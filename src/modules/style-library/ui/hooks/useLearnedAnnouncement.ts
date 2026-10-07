import { useEffect, useRef, useState } from 'react'
import type { StyleFile } from '@shared/contracts/style-library'

/**
 * The text for the screen reader's polite live region: "Learned from {file name}" each time a file
 * moves to learned (not once per row, and not for files that were already learned on arrival).
 */
export function useLearnedAnnouncement(files: readonly StyleFile[]): string {
  const known = useRef<Map<string, StyleFile['status']> | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const previous = known.current
    known.current = new Map(files.map((file) => [file.id, file.status]))
    if (!previous) return
    const newlyLearned = files.filter(
      (file) =>
        file.status === 'learned' && previous.has(file.id) && previous.get(file.id) !== 'learned'
    )
    if (newlyLearned.length > 0)
      setMessage(`Learned from ${newlyLearned[newlyLearned.length - 1].name}`)
  }, [files])

  return message
}
