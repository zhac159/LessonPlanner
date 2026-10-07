import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import type { StrokePath } from '@shared/contracts/deck-builder-chat'
import { clientToSlide } from './geometry'

export interface PointerLoopOptions {
  /** Drawing enabled (the Circle tool is on). */
  active: boolean
  /** The element whose box maps pointer positions to slide units. */
  boxRef: RefObject<HTMLElement | null>
  /** Displayed pixels per slide unit; measured from the box when omitted. */
  scale?: number
  /** Pointer released after moving: the raw points, in slide units. */
  onComplete: (points: StrokePath) => void
  /** Pointer released without moving (a click), in slide units. */
  onPoint?: (point: [number, number]) => void
  /** The stroke was abandoned (Esc, pointer cancelled, tool switched off). */
  onCancel?: () => void
}

/**
 * Freehand drawing with the pointer: down starts a stroke (with pointer capture), moves add raw
 * points, up completes it, Esc or a cancelled pointer abandons it. Returns the live stroke and
 * the handlers for the overlay element.
 */
export function usePointerLoop({
  active,
  boxRef,
  scale,
  onComplete,
  onPoint,
  onCancel
}: PointerLoopOptions) {
  const [stroke, setStroke] = useState<StrokePath | null>(null)
  const points = useRef<StrokePath | null>(null)
  const pointer = useRef<number | null>(null)
  const latest = useRef({ onComplete, onPoint, onCancel })
  latest.current = { onComplete, onPoint, onCancel }

  const reset = useCallback((): void => {
    points.current = null
    pointer.current = null
    setStroke(null)
  }, [])

  const cancel = useCallback((): void => {
    if (points.current === null) return
    reset()
    latest.current.onCancel?.()
  }, [reset])

  const toSlide = (clientX: number, clientY: number): [number, number] => {
    const box = boxRef.current?.getBoundingClientRect()
    return clientToSlide(clientX, clientY, box ?? { left: 0, top: 0, width: 0, height: 0 }, scale)
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (!active || event.button !== 0 || points.current !== null) return
    if (event.target instanceof Element && event.target.closest('button')) return
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic pointers (tests, some touch input) cannot be captured; drawing still works.
    }
    pointer.current = event.pointerId
    points.current = [toSlide(event.clientX, event.clientY)]
    setStroke([...points.current])
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>): void => {
    if (points.current === null || event.pointerId !== pointer.current) return
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? []
    for (const sample of samples.length > 0 ? samples : [event.nativeEvent]) {
      const next = toSlide(sample.clientX, sample.clientY)
      const last = points.current[points.current.length - 1]
      if (next[0] !== last[0] || next[1] !== last[1]) points.current.push(next)
    }
    setStroke([...points.current])
  }

  const onPointerUp = (event: PointerEvent<HTMLElement>): void => {
    if (points.current === null || event.pointerId !== pointer.current) return
    const done = points.current
    reset()
    if (done.length >= 2) latest.current.onComplete(done)
    else latest.current.onPoint?.(done[0])
  }

  // Esc abandons the stroke before anything else (the stage's own Esc chain) sees the key.
  const drawing = stroke !== null
  useEffect(() => {
    if (!drawing) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      cancel()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [drawing, cancel])

  // Switching the tool off mid-stroke drops it.
  useEffect(() => {
    if (!active) cancel()
  }, [active, cancel])

  return {
    stroke,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: cancel,
      onLostPointerCapture: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerId === pointer.current) cancel()
      }
    }
  }
}
