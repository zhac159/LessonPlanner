import type { ChangeSet } from '@shared/deck/types'

/** The slides a ChangeSet added or replaced: they flash in the filmstrip when it lands (06 §7). Pure. */
export function changedSlideIds(changeSet: ChangeSet): string[] {
  const ids: string[] = []
  for (const op of changeSet.ops) {
    if (op.op === 'insertSlides') ids.push(...op.slides.map((slide) => slide.id))
    else if (op.op === 'replaceSlide') ids.push(op.slide.id)
  }
  return [...new Set(ids)]
}
