/**
 * The ChangeSets of the teacher's direct edits (06 §8.3): one edit = one plan = one undo step. Pure: ids come in
 * through `newId` so tests are deterministic.
 */
import type { DeckOp, Element, Slide, TextElement } from '@shared/deck/types'
import { buildTextSlide } from '@shared/plugins/slides'
import { newId as makeId } from '@shared/ids'
import { textToParagraphs, type EditableElement } from './textEdit'

/** What `applyOps` needs: the operations and the sentence shown for the step ("Undo: Moved a slide"). */
export interface EditPlan {
  ops: DeckOp[]
  summary: string
  /** A slide the edit created: the screen selects it once the edit landed. */
  selectId?: string
}

export type IdMaker = (prefix: string) => string

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** Moves a slide after another one, or first when `afterSlideId` is null. */
export function moveSlidePlan(slideId: string, afterSlideId: string | null): EditPlan {
  return { ops: [{ op: 'moveSlide', slideId, afterSlideId }], summary: 'Moved a slide' }
}

/** Removes one or several slides in a single step. */
export function deleteSlidesPlan(slideIds: readonly string[]): EditPlan {
  return {
    ops: [{ op: 'deleteSlides', slideIds: [...slideIds] }],
    summary: `Deleted ${plural(slideIds.length, 'slide', 'slides')}`
  }
}

/** A copy of `slide` with fresh ids, ready to insert after the original. */
export function copyOfSlide(slide: Slide, newId: IdMaker = makeId): Slide {
  const copy = structuredClone(slide) as Slide
  copy.id = newId('sld')
  copy.elements = copy.elements.map((element) => ({ ...element, id: newId('el') }))
  copy.source = { by: 'user' }
  return copy
}

/** Duplicates a slide right after itself. */
export function duplicateSlidePlan(slide: Slide, newId: IdMaker = makeId): EditPlan {
  const copy = copyOfSlide(slide, newId)
  return {
    ops: [{ op: 'insertSlides', afterSlideId: slide.id, slides: [copy] }],
    summary: 'Duplicated a slide',
    selectId: copy.id
  }
}

/**
 * A blank slide on the same layout as `template` (its locked decorations stay; its text boxes are emptied).
 * Without a template it is a plain titled slide.
 */
export function blankSlideLike(template: Slide | undefined, newId: IdMaker = makeId): Slide {
  const id = newId('sld')
  if (!template) {
    return buildTextSlide(
      { id, kind: 'content', title: '', body: [{ runs: [{ text: '' }] }] },
      null,
      {
        slides: []
      }
    )
  }
  const elements = template.elements
    .filter((element) => element.locked || element.type === 'text')
    .map((element): Element => {
      const base = { ...structuredClone(element), id: newId('el') }
      return base.type === 'text' && !base.locked
        ? { ...base, paragraphs: [{ runs: [{ text: '' }] }] }
        : base
    })
  return {
    id,
    kind: 'content',
    ...(template.layoutId ? { layoutId: template.layoutId } : {}),
    elements,
    source: { by: 'user' }
  }
}

/** Adds a blank slide after `afterSlideId` (first when null). */
export function addSlidePlan(afterSlideId: string | null, slide: Slide): EditPlan {
  return {
    ops: [{ op: 'insertSlides', afterSlideId, slides: [slide] }],
    summary: 'Added a slide',
    selectId: slide.id
  }
}

/** The template an "Add slide" copies: the selected slide when it is a content slide, else the last one that is. */
export function templateFor(
  slides: readonly Slide[],
  selectedId: string | null
): Slide | undefined {
  const selected = slides.find((slide) => slide.id === selectedId)
  if (selected?.kind === 'content') return selected
  return [...slides].reverse().find((slide) => slide.kind === 'content') ?? selected
}

/** The text typed in place of an element's text (callers skip it when the text is unchanged). */
export function editTextPlan(slideId: string, element: EditableElement, text: string): EditPlan {
  return {
    ops: [
      {
        op: 'updateElement',
        slideId,
        elementId: element.id,
        set: { paragraphs: textToParagraphs(element.paragraphs, text) }
      }
    ],
    summary: 'Edited text'
  }
}

/** A new body text box at a point of the slide (the Text tool). */
export function newTextBox(
  at: { x: number; y: number },
  text: string,
  newId: IdMaker = makeId
): TextElement {
  const w = 800
  return {
    id: newId('el'),
    type: 'text',
    role: 'body',
    x: Math.round(Math.min(Math.max(at.x, 0), 1920 - w)),
    y: Math.round(Math.min(Math.max(at.y, 0), 1080 - 120)),
    w,
    h: 120,
    paragraphs: text.split('\n').map((line) => ({ runs: [{ text: line }] }))
  }
}

export function addElementPlan(slideId: string, element: Element): EditPlan {
  return { ops: [{ op: 'addElement', slideId, element }], summary: 'Added a text box' }
}

/** Moves an element to new coordinates (drag or arrow keys), kept on the slide. */
export function moveElementPlan(
  slideId: string,
  element: Element,
  to: { x: number; y: number }
): EditPlan {
  const x = Math.round(Math.min(Math.max(to.x, 0), 1920 - Math.min(element.w, 1920)))
  const y = Math.round(Math.min(Math.max(to.y, 0), 1080 - Math.min(element.h, 1080)))
  return {
    ops: [{ op: 'updateElement', slideId, elementId: element.id, set: { x, y } }],
    summary: 'Moved an element'
  }
}

export function removeElementPlan(slideId: string, elementId: string): EditPlan {
  return { ops: [{ op: 'removeElement', slideId, elementId }], summary: 'Deleted an element' }
}
