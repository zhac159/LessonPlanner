/**
 * Which filmstrip slides are selected (06 §8.1). Pure: the hooks feed it the current slide ids.
 *
 * `ids` is always in deck order. `current` is the slide on the stage (the last one clicked); `anchor` is where a
 * Shift range starts. Both are always members of `ids`, or null when the deck has no slides.
 */
export interface SlideSelection {
  ids: string[]
  current: string | null
  anchor: string | null
}

export const EMPTY_SELECTION: SlideSelection = { ids: [], current: null, anchor: null }

/** Where a keyboard step goes: one slide back or forward, or to either end. */
export type SelectionStep = 'prev' | 'next' | 'first' | 'last'

/** A plain click: just this slide. */
export function selectOnly(id: string): SlideSelection {
  return { ids: [id], current: id, anchor: id }
}

const inDeckOrder = (slideIds: readonly string[], wanted: ReadonlySet<string>): string[] =>
  slideIds.filter((id) => wanted.has(id))

/** Shift+click or Shift+arrow: everything from the anchor to `id`; `id` becomes the slide on the stage. */
export function extendTo(
  slideIds: readonly string[],
  selection: SlideSelection,
  id: string
): SlideSelection {
  const to = slideIds.indexOf(id)
  if (to < 0) return selection
  const anchor = selection.anchor && slideIds.includes(selection.anchor) ? selection.anchor : id
  const from = slideIds.indexOf(anchor)
  const [low, high] = from <= to ? [from, to] : [to, from]
  return { ids: slideIds.slice(low, high + 1), current: id, anchor }
}

/** Ctrl+click: adds or removes one slide. The last slide cannot be removed. */
export function toggleId(
  slideIds: readonly string[],
  selection: SlideSelection,
  id: string
): SlideSelection {
  if (!slideIds.includes(id)) return selection
  if (!selection.ids.includes(id)) {
    return {
      ids: inDeckOrder(slideIds, new Set([...selection.ids, id])),
      current: id,
      anchor: id
    }
  }
  if (selection.ids.length === 1) return selection
  const rest = selection.ids.filter((other) => other !== id)
  const current = selection.current === id ? (rest[rest.length - 1] ?? null) : selection.current
  return { ids: rest, current, anchor: current }
}

/** The slide a step lands on, clamped to the ends; null for an empty deck. */
export function stepTarget(
  slideIds: readonly string[],
  from: string | null,
  step: SelectionStep
): string | null {
  if (slideIds.length === 0) return null
  const index = from ? slideIds.indexOf(from) : -1
  if (step === 'first') return slideIds[0]
  if (step === 'last') return slideIds[slideIds.length - 1]
  const next = step === 'next' ? index + 1 : index - 1
  return slideIds[Math.min(Math.max(next, 0), slideIds.length - 1)]
}

/** Arrow keys, Home and End in the filmstrip; `extend` (Shift) grows the range instead of moving. */
export function stepSelection(
  slideIds: readonly string[],
  selection: SlideSelection,
  step: SelectionStep,
  extend: boolean
): SlideSelection {
  const target = stepTarget(slideIds, selection.current, step)
  if (!target) return EMPTY_SELECTION
  return extend ? extendTo(slideIds, selection, target) : selectOnly(target)
}

/**
 * Keeps a selection valid after the deck changed. Slides that are gone drop out; when the slide on the stage went,
 * the slide that took its place (same position, or the last) is shown. AI changes never move the selection (06 §8.9).
 */
export function reconcileSelection(
  slideIds: readonly string[],
  selection: SlideSelection,
  previousIds: readonly string[]
): SlideSelection {
  if (slideIds.length === 0) return EMPTY_SELECTION
  const alive = new Set(slideIds)
  const kept = selection.ids.filter((id) => alive.has(id))
  if (selection.current && alive.has(selection.current)) {
    const anchor =
      selection.anchor && alive.has(selection.anchor) ? selection.anchor : selection.current
    return { ids: inDeckOrder(slideIds, new Set(kept)), current: selection.current, anchor }
  }
  const was = selection.current ? previousIds.indexOf(selection.current) : -1
  const fallback = slideIds[Math.min(Math.max(was, 0), slideIds.length - 1)]
  return selectOnly(fallback)
}
