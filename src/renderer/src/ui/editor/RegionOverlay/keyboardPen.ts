import type { StrokePath } from '@shared/contracts/deck-builder-chat'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@shared/deck/types'
import { movePoint } from './geometry'

/** Slide units a plain arrow press moves the keyboard pen; Shift moves four times as far. */
export const PEN_STEP = 40
export const PEN_STEP_LARGE = PEN_STEP * 4

/** The keyboard pen: a cursor, and the loop being drawn once Enter has put the pen down. */
export interface PenState {
  cursor: [number, number]
  stroke: StrokePath | null
}

export interface PenOutcome {
  state: PenState
  /** The key was used: the caller should prevent its default. */
  handled: boolean
  /** A loop was finished with Enter: its raw points. */
  complete?: StrokePath
  /** A loop in progress was abandoned (Esc, or Enter without moving). */
  cancelled?: boolean
}

/** Pen in the middle of the slide with nothing drawn. */
export function initialPen(): PenState {
  return { cursor: [SLIDE_WIDTH / 2, SLIDE_HEIGHT / 2], stroke: null }
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

/**
 * The keyboard alternative to drawing a loop (06 §8.4): arrows move the pen, Enter puts it down
 * and, pressed again, lifts it and completes the loop, Esc abandons a loop in progress. While the
 * pen is down every arrow press adds a point, so a loop is a handful of presses.
 */
export function penKey(state: PenState, key: string, shift: boolean): PenOutcome {
  const arrow = ARROWS[key]
  if (arrow) {
    const step = shift ? PEN_STEP_LARGE : PEN_STEP
    const cursor = movePoint(state.cursor, arrow[0] * step, arrow[1] * step)
    const stroke = state.stroke ? [...state.stroke, cursor] : null
    return { state: { cursor, stroke }, handled: true }
  }
  if (key === 'Enter') {
    if (!state.stroke) return { state: { ...state, stroke: [state.cursor] }, handled: true }
    const done = { ...state, stroke: null }
    return state.stroke.length >= 3
      ? { state: done, handled: true, complete: state.stroke }
      : { state: done, handled: true, cancelled: true }
  }
  if (key === 'Escape' && state.stroke) {
    return { state: { ...state, stroke: null }, handled: true, cancelled: true }
  }
  return { state, handled: false }
}
