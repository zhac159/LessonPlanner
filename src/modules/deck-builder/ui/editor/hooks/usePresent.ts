import { useCallback, useEffect, useRef, useState } from 'react'

export interface Present {
  /** The show is up and starts on this slide; null when it is not. */
  presenting: { index: number } | null
  start(index: number): void
  /** Ends the show; `index` is the slide she was on. */
  exit(index: number): void
}

const setFullScreen = (on: boolean): void => {
  try {
    window.api.window.setFullScreen(on)
  } catch {
    // No bridge (a test or a preview): the show still works in the window.
  }
}

/**
 * Present mode (06 §8.12): the window goes full screen while the show is up and returns when it ends. The window is
 * also released if the editor goes away mid-show. `onExit` runs after the show closed, to select the slide she ended on.
 */
export function usePresent(canStart: boolean, onExit: (index: number) => void): Present {
  const [presenting, setPresenting] = useState<{ index: number } | null>(null)
  const live = useRef(false)
  const latest = useRef(onExit)
  latest.current = onExit

  const start = useCallback(
    (index: number) => {
      if (!canStart || live.current) return
      live.current = true
      setFullScreen(true)
      setPresenting({ index })
    },
    [canStart]
  )

  const exit = useCallback((index: number) => {
    if (!live.current) return
    live.current = false
    setFullScreen(false)
    setPresenting(null)
    latest.current(index)
  }, [])

  useEffect(
    () => () => {
      if (live.current) setFullScreen(false)
    },
    []
  )

  return { presenting, start, exit }
}
