import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { findFitFactor, type FitMeasurer } from './fit'

export interface TextFitInputs {
  /** Shrink in 2% steps down to 60% when the text overflows. */
  shrink: boolean
  /** Measure even without shrinking (to report/badge overflow). */
  track: boolean
  measurer: FitMeasurer
  /** Anything that changes what has to be measured: re-fits when it changes identity. */
  content: unknown
  style: unknown
  sizePt: number
  width: number
  height: number
  onOverflowChange?: (overflow: boolean) => void
}

/**
 * Fits text inside its box by writing the `--fit` CSS variable (font-size = base * --fit) on the box.
 * Returns the ref for the box and whether the text still overflows at the final size. Re-fits when
 * fonts finish loading, because metrics change.
 */
export function useTextFit(inputs: TextFitInputs): {
  ref: RefObject<HTMLDivElement | null>
  overflow: boolean
} {
  const { shrink, track, measurer, content, style, sizePt, width, height } = inputs
  const ref = useRef<HTMLDivElement | null>(null)
  const [overflow, setOverflow] = useState(false)
  const notify = useRef(inputs.onOverflowChange)
  notify.current = inputs.onOverflowChange

  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    if (!shrink && !track) {
      box.style.removeProperty('--fit')
      setOverflow(false)
      return
    }
    const run = (): void => {
      const result = findFitFactor((factor) => {
        box.style.setProperty('--fit', String(factor))
        return measurer(box, factor)
      }, shrink)
      box.style.setProperty('--fit', String(result.factor))
      setOverflow(result.overflow)
    }
    run()
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    fonts?.addEventListener?.('loadingdone', run)
    return () => fonts?.removeEventListener?.('loadingdone', run)
  }, [shrink, track, measurer, content, style, sizePt, width, height])

  useLayoutEffect(() => {
    if (!overflow) return
    notify.current?.(true)
    return () => notify.current?.(false)
  }, [overflow])

  return { ref, overflow }
}
