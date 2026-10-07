import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { SLIDE_WIDTH } from '@shared/deck/types'

/**
 * Scale that fits the 1920-unit slide into its host element's width. Tracks resizes with a ResizeObserver.
 * An `override` (tests, fixed-size renders) wins and skips observing.
 */
export function useContainerScale(override?: number): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null)
  const [measured, setMeasured] = useState(0.25)

  useLayoutEffect(() => {
    const host = ref.current
    if (!host || override !== undefined) return
    const update = (): void => {
      const width = host.clientWidth
      if (width > 0) setMeasured(width / SLIDE_WIDTH)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(host)
    return () => observer.disconnect()
  }, [override])

  return [ref, override ?? measured]
}
