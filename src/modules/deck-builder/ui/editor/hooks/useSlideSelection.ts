import { useCallback, useState } from 'react'
import {
  EMPTY_SELECTION,
  extendTo,
  reconcileSelection,
  selectOnly,
  stepSelection,
  toggleId,
  type SelectionStep,
  type SlideSelection
} from '../logic/selection'

const KEY = (lessonId: string): string => `slide-planner:last-slide:${lessonId}`

/** The slide the teacher was last on in this lesson (a convenience: storage may be unavailable). */
export function readLastSlide(lessonId: string): string | null {
  try {
    return window.localStorage.getItem(KEY(lessonId))
  } catch {
    return null
  }
}

function rememberSlide(lessonId: string, slideId: string | null): void {
  try {
    if (slideId) window.localStorage.setItem(KEY(lessonId), slideId)
  } catch {
    // Not remembered: the lesson opens on its first slide next time.
  }
}

export interface SlideSelectionApi {
  selection: SlideSelection
  /** Plain click. */
  select(id: string): void
  /** Shift+click. */
  extend(id: string): void
  /** Ctrl+click. */
  toggle(id: string): void
  /** Arrow keys, Home, End (Shift extends). */
  step(step: SelectionStep, extend?: boolean): void
  /** Back to just the slide on the stage (Esc in the filmstrip). */
  collapse(): void
}

const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i])

/**
 * The filmstrip selection (06 §8.1) for the deck's slides in order. It follows deck changes: slides that disappear
 * drop out and the neighbour takes over, but AI changes never move it. The first slide of a lesson (or the one she was
 * last on) is selected as soon as there is one.
 */
export function useSlideSelection(
  lessonId: string,
  slideIds: readonly string[]
): SlideSelectionApi {
  const [state, setState] = useState(() => {
    const remembered = readLastSlide(lessonId)
    const first = slideIds[0]
    const start = remembered && slideIds.includes(remembered) ? remembered : first
    const initial = start ? selectOnly(start) : EMPTY_SELECTION
    return { selection: initial, ids: slideIds as readonly string[] }
  })

  let selection = state.selection
  if (!sameIds(state.ids, slideIds)) {
    const remembered = readLastSlide(lessonId)
    selection =
      state.ids.length === 0 && remembered && slideIds.includes(remembered)
        ? selectOnly(remembered)
        : reconcileSelection(slideIds, state.selection, state.ids)
    setState({ selection, ids: slideIds })
  }

  const update = useCallback(
    (make: (current: SlideSelection) => SlideSelection) => {
      setState((was) => {
        const next = make(was.selection)
        rememberSlide(lessonId, next.current)
        return { ...was, selection: next }
      })
    },
    [lessonId]
  )

  return {
    selection,
    select: useCallback((id) => update(() => selectOnly(id)), [update]),
    extend: useCallback((id) => update((s) => extendTo(slideIds, s, id)), [update, slideIds]),
    toggle: useCallback((id) => update((s) => toggleId(slideIds, s, id)), [update, slideIds]),
    step: useCallback(
      (step, extend = false) => update((s) => stepSelection(slideIds, s, step, extend)),
      [update, slideIds]
    ),
    collapse: useCallback(() => update((s) => (s.current ? selectOnly(s.current) : s)), [update])
  }
}
