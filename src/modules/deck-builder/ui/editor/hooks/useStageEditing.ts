import { useCallback, useEffect, useState } from 'react'
import type { Element, Slide } from '@shared/deck/types'
import type { PlanSource } from './useDeckEdits'
import {
  addElementPlan,
  editTextPlan,
  moveElementPlan,
  newTextBox,
  removeElementPlan
} from '../logic/changes'
import { nudgeDelta } from '../logic/elements'
import { isEditableText, textChanged } from '../logic/textEdit'

export interface StageEditing {
  selectedId: string | null
  /** The element in the deck that is picked (gone after undo or a deletion elsewhere: then null). */
  selected: Element | null
  editingId: string | null
  /** Where the Text tool was clicked; the new box is typed there. */
  draft: { x: number; y: number } | null
  select(id: string | null): void
  startEdit(id: string): void
  startDraft(at: { x: number; y: number }): void
  commitEdit(element: Element, text: string): void
  commitDraft(draft: { x: number; y: number }, text: string): void
  move(element: Element, to: { x: number; y: number }): void
  /** Arrow keys: 10 units (Shift 50). Returns false when nothing is picked. */
  nudge(key: string, shift: boolean): boolean
  /** Delete or Backspace on the picked element. Returns false when nothing was removed. */
  removeSelected(): boolean
}

/**
 * Direct editing of the slide on the stage (06 §8.2): the picked element, in-place text editing, a new text box, moves
 * and deletes. Every change goes out as one `EditPlan`, which the screen applies as one undo step. Picking and
 * editing reset when the slide changes.
 */
export function useStageEditing(
  slide: Slide | null,
  readOnly: boolean,
  apply: (plan: PlanSource) => Promise<boolean>,
  onDraftDone: () => void
): StageEditing {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null)
  const slideId = slide?.id ?? null

  useEffect(() => {
    setSelectedId(null)
    setEditingId(null)
    setDraft(null)
  }, [slideId])

  const selected = slide?.elements.find((element) => element.id === selectedId) ?? null

  const commitEdit = useCallback(
    (element: Element, text: string) => {
      setEditingId(null)
      if (!slide || !isEditableText(element) || !textChanged(element, text)) return
      void apply(editTextPlan(slide.id, element, text))
    },
    [slide, apply]
  )

  const commitDraft = useCallback(
    (at: { x: number; y: number }, text: string) => {
      setDraft(null)
      onDraftDone()
      if (!slide || !text.trim()) return
      const element = newTextBox(at, text)
      void apply(addElementPlan(slide.id, element)).then(
        (done) => done && setSelectedId(element.id)
      )
    },
    [slide, apply, onDraftDone]
  )

  const move = useCallback(
    (element: Element, to: { x: number; y: number }) => {
      if (!slide || readOnly || element.locked) return
      void apply(moveElementPlan(slide.id, element, to))
    },
    [slide, readOnly, apply]
  )

  const nudge = useCallback(
    (key: string, shift: boolean) => {
      const delta = nudgeDelta(key, shift)
      if (!delta || !slide || !selected || readOnly || selected.locked) return false
      void apply((deck) => {
        const element = deck.slides
          .find((s) => s.id === slide.id)
          ?.elements.find((e) => e.id === selected.id)
        return element
          ? moveElementPlan(slide.id, element, { x: element.x + delta.dx, y: element.y + delta.dy })
          : null
      })
      return true
    },
    [slide, selected, readOnly, apply]
  )

  const removeSelected = useCallback(() => {
    if (!slide || !selected || readOnly || selected.locked) return false
    void apply(removeElementPlan(slide.id, selected.id))
    setSelectedId(null)
    return true
  }, [slide, selected, readOnly, apply])

  return {
    selectedId,
    selected,
    editingId,
    draft,
    select: setSelectedId,
    startEdit: useCallback((id: string) => !readOnly && setEditingId(id), [readOnly]),
    startDraft: useCallback(
      (at: { x: number; y: number }) => !readOnly && setDraft(at),
      [readOnly]
    ),
    commitEdit,
    commitDraft,
    move,
    nudge,
    removeSelected
  }
}
