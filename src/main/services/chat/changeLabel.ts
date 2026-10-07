/**
 * The ResultChip's label and affected slides for the ChangeSets of one assistant message (06 §8.6):
 * "{n} slides added", "Slide {k} changed", "{n} slides changed", "{n} slides removed", "{n} quiz slides added".
 * Pure.
 */
import type { ChangeSet, DeckOp, Slide } from '@shared/deck/types'

export interface ChangeLabel {
  label: string
  /** Slides added or changed (removed slides no longer exist), in the order they were touched. */
  slideIds: string[]
}

const slides = (n: number): string => `${n} ${n === 1 ? 'slide' : 'slides'}`

function touched(op: DeckOp): { added: Slide[]; removed: string[]; changed: string[] } {
  switch (op.op) {
    case 'insertSlides':
      return { added: op.slides, removed: [], changed: [] }
    case 'deleteSlides':
      return { added: [], removed: op.slideIds, changed: [] }
    case 'replaceSlide':
      return { added: [], removed: [], changed: [op.slide.id] }
    case 'moveSlide':
    case 'updateSlide':
    case 'addElement':
    case 'updateElement':
    case 'removeElement':
      return { added: [], removed: [], changed: [op.slideId] }
    case 'setMeta':
      return { added: [], removed: [], changed: [] }
  }
}

const unique = (ids: readonly string[]): string[] => [...new Set(ids)]

/**
 * Describes what `changeSets` did. `deckSlideIds` (the current deck, in order) gives "Slide {k}" its number;
 * changes without slide operations (a rename) fall back to the last ChangeSet's own summary.
 */
export function describeChanges(
  changeSets: readonly ChangeSet[],
  deckSlideIds: readonly string[]
): ChangeLabel {
  const added: Slide[] = []
  const removed: string[] = []
  const changed: string[] = []
  for (const op of changeSets.flatMap((c) => c.ops)) {
    const t = touched(op)
    added.push(...t.added)
    removed.push(...t.removed)
    changed.push(...t.changed)
  }
  const gone = new Set(removed)
  const addedIds = added.map((s) => s.id).filter((id) => !gone.has(id))
  const changedIds = unique(changed).filter((id) => !gone.has(id) && !addedIds.includes(id))
  const slideIds = [...addedIds, ...changedIds]

  if (changedIds.length === 0 && removed.length === 0 && addedIds.length > 0) {
    const quiz = added.filter((s) => s.kind === 'quiz' || s.kind === 'answers')
    const label =
      quiz.length === added.length
        ? `${quiz.length} quiz ${quiz.length === 1 ? 'slide' : 'slides'} added`
        : `${slides(addedIds.length)} added`
    return { label, slideIds }
  }
  if (addedIds.length === 0 && changedIds.length === 0 && removed.length > 0)
    return { label: `${slides(unique(removed).length)} removed`, slideIds: [] }
  if (addedIds.length === 0 && changedIds.length === 1) {
    const position = deckSlideIds.indexOf(changedIds[0])
    return {
      label: position === -1 ? '1 slide changed' : `Slide ${position + 1} changed`,
      slideIds
    }
  }
  if (slideIds.length > 0 || removed.length > 0)
    return { label: `${slides(slideIds.length + unique(removed).length)} changed`, slideIds }
  return { label: changeSets.at(-1)?.summary ?? 'Changed the lesson', slideIds }
}
