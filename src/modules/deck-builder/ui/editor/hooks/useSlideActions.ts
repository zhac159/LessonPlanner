import { useCallback } from 'react'
import type { Slide } from '@shared/deck/types'
import { useToast } from '@ui/overlays'
import {
  addSlidePlan,
  blankSlideLike,
  deleteSlidesPlan,
  duplicateSlidePlan,
  moveSlidePlan,
  templateFor,
  type EditPlan
} from '../logic/changes'
import type { PlanSource } from './useDeckEdits'

export interface SlideActions {
  move(slideId: string, afterSlideId: string | null): void
  /** Adds a blank slide after `afterId` (first when null) on the layout of the nearest content slide. */
  addAfter(afterId: string | null): void
  duplicate(slideId: string): void
  /** Removes slides in one step, with a toast that offers Undo (06 §8.1). */
  remove(slideIds: string[]): void
}

/**
 * The filmstrip's slide edits (06 §8.1): each is one ChangeSet through `apply`. A slide the edit created is selected
 * once it landed.
 */
export function useSlideActions(
  slides: ReadonlyArray<Slide>,
  apply: (source: PlanSource) => Promise<boolean>,
  undo: () => Promise<void>,
  select: (slideId: string) => void
): SlideActions {
  const toast = useToast()

  const run = useCallback(
    (plan: EditPlan) => {
      void apply(plan).then((done) => {
        if (done && plan.selectId) select(plan.selectId)
      })
    },
    [apply, select]
  )

  const addAfter = useCallback(
    (afterId: string | null) => {
      run(addSlidePlan(afterId, blankSlideLike(templateFor(slides, afterId))))
    },
    [slides, run]
  )

  const duplicate = useCallback(
    (slideId: string) => {
      const original = slides.find((s) => s.id === slideId)
      if (original) run(duplicateSlidePlan(original))
    },
    [slides, run]
  )

  const remove = useCallback(
    (slideIds: string[]) => {
      void apply(deleteSlidesPlan(slideIds)).then((done) => {
        if (!done) return
        toast.show({
          message: slideIds.length === 1 ? 'Slide deleted' : `${slideIds.length} slides deleted`,
          action: { label: 'Undo', onAction: () => void undo() }
        })
      })
    },
    [apply, undo, toast]
  )

  const move = useCallback(
    (slideId: string, afterSlideId: string | null) => run(moveSlidePlan(slideId, afterSlideId)),
    [run]
  )

  return { move, addAfter, duplicate, remove }
}
