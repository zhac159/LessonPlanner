/**
 * One handler per DeckOp (design/deck-model.md §3). Each handler mutates an immer draft of the deck and
 * returns an error message when the op is invalid (it then must not have changed anything). Used only by
 * `applyChangeSet`, which owns validation of the ChangeSet as a whole, normalisation and patches.
 */
import { current, isDraft, type Draft } from 'immer'
import { elementSchema } from './schema'
import type { Deck, DeckOp, Element, Slide } from './types'

export interface OpContext {
  /** Lets ops move/remove locked elements (the teacher explicitly asked for it). */
  allowLocked: boolean
}

type OpOf<K extends DeckOp['op']> = Extract<DeckOp, { op: K }>

/** Keys of an element that "move" it: forbidden on locked elements. */
const LOCKED_KEYS = ['x', 'y', 'w', 'h', 'rotation', 'locked'] as const

const find = <T extends { id: string }>(items: readonly T[], id: string): number =>
  items.findIndex((item) => item.id === id)

/** Unwraps `undefined` values of a patch into deletions (JSON cannot carry `undefined`). */
function assignPatch(target: object, patch: object): void {
  const t = target as Record<string, unknown>
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete t[key]
    else t[key] = value
  }
}

function lockedProblem(
  slide: Slide,
  element: Element,
  ctx: OpContext,
  verb: string
): string | null {
  return element.locked && !ctx.allowLocked
    ? `element "${element.id}" on slide "${slide.id}" is locked (a style decoration): it cannot be ${verb}`
    : null
}

/** Position of the insertion point "after slide X" (`null` = start); -1 when X does not exist. */
function insertionIndex(slides: readonly Slide[], afterSlideId: string | null): number {
  if (afterSlideId === null) return 0
  const i = find(slides, afterSlideId)
  return i === -1 ? -1 : i + 1
}

function insertSlides(deck: Draft<Deck>, op: OpOf<'insertSlides'>): string | null {
  const at = insertionIndex(deck.slides, op.afterSlideId)
  if (at === -1) return `unknown slide id "${op.afterSlideId}" in afterSlideId`
  const incoming = new Set<string>()
  for (const slide of op.slides) {
    if (find(deck.slides, slide.id) !== -1 || incoming.has(slide.id)) {
      return `slide id "${slide.id}" already exists`
    }
    incoming.add(slide.id)
  }
  deck.slides.splice(at, 0, ...(op.slides as Draft<Slide>[]))
  return null
}

function deleteSlides(deck: Draft<Deck>, op: OpOf<'deleteSlides'>): string | null {
  const unknown = op.slideIds.filter((id) => find(deck.slides, id) === -1)
  if (unknown.length) return `unknown slide id(s): ${unknown.map((id) => `"${id}"`).join(', ')}`
  // splice one by one: small patches (reassigning the array would put the whole deck in the history)
  for (const id of new Set(op.slideIds)) deck.slides.splice(find(deck.slides, id), 1)
  return null
}

function moveSlide(deck: Draft<Deck>, op: OpOf<'moveSlide'>): string | null {
  const from = find(deck.slides, op.slideId)
  if (from === -1) return `unknown slide id "${op.slideId}"`
  if (op.afterSlideId === op.slideId) return 'a slide cannot be moved after itself'
  if (op.afterSlideId !== null && find(deck.slides, op.afterSlideId) === -1) {
    return `unknown slide id "${op.afterSlideId}" in afterSlideId`
  }
  const [slide] = deck.slides.splice(from, 1)
  deck.slides.splice(insertionIndex(deck.slides, op.afterSlideId), 0, slide)
  return null
}

function replaceSlide(deck: Draft<Deck>, op: OpOf<'replaceSlide'>, ctx: OpContext): string | null {
  const i = find(deck.slides, op.slide.id)
  if (i === -1) return `unknown slide id "${op.slide.id}"`
  if (!ctx.allowLocked) {
    for (const old of deck.slides[i].elements.filter((e) => e.locked)) {
      const kept = op.slide.elements.find((e) => e.id === old.id)
      const same = kept && LOCKED_KEYS.every((k) => k === 'locked' || kept[k] === old[k])
      if (!kept || !same || !kept.locked) {
        return `slide "${op.slide.id}" has locked element "${old.id}": keep it unchanged in the replacement`
      }
    }
  }
  deck.slides[i] = op.slide as Draft<Slide>
  return null
}

function updateSlide(deck: Draft<Deck>, op: OpOf<'updateSlide'>): string | null {
  const slide = deck.slides[find(deck.slides, op.slideId)]
  if (!slide) return `unknown slide id "${op.slideId}"`
  assignPatch(slide, op.set)
  return null
}

function addElement(deck: Draft<Deck>, op: OpOf<'addElement'>): string | null {
  const slide = deck.slides[find(deck.slides, op.slideId)]
  if (!slide) return `unknown slide id "${op.slideId}"`
  if (find(slide.elements, op.element.id) !== -1) {
    return `element id "${op.element.id}" already exists on slide "${op.slideId}"`
  }
  slide.elements.push(op.element as Draft<Element>)
  return null
}

function updateElement(
  deck: Draft<Deck>,
  op: OpOf<'updateElement'>,
  ctx: OpContext
): string | null {
  const slide = deck.slides[find(deck.slides, op.slideId)]
  if (!slide) return `unknown slide id "${op.slideId}"`
  const element = slide.elements[find(slide.elements, op.elementId)]
  if (!element) return `unknown element id "${op.elementId}" on slide "${op.slideId}"`
  const keys = Object.keys(op.set)
  if (keys.some((k) => (LOCKED_KEYS as readonly string[]).includes(k))) {
    const problem = lockedProblem(slide, element, ctx, 'moved or resized')
    if (problem) return problem
  }
  const merged = { ...(isDraft(element) ? current(element) : element), ...op.set } as Record<
    string,
    unknown
  >
  for (const key of keys) if (merged[key] === undefined) delete merged[key]
  const parsed = elementSchema.safeParse(merged)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return `invalid update of element "${op.elementId}": ${issue.path.join('.') || 'element'}: ${issue.message}`
  }
  const stray = keys.filter(
    (k) => (op.set as Record<string, unknown>)[k] !== undefined && !(k in parsed.data)
  )
  if (stray.length)
    return `element "${op.elementId}" is a ${element.type} and has no property ${stray.join(', ')}`
  // Copy from the parsed result so sanitised values (diagram SVG) are what gets stored.
  const clean: Record<string, unknown> = {}
  for (const key of keys) clean[key] = (parsed.data as Record<string, unknown>)[key]
  assignPatch(element, clean)
  return null
}

function removeElement(
  deck: Draft<Deck>,
  op: OpOf<'removeElement'>,
  ctx: OpContext
): string | null {
  const slide = deck.slides[find(deck.slides, op.slideId)]
  if (!slide) return `unknown slide id "${op.slideId}"`
  const i = find(slide.elements, op.elementId)
  if (i === -1) return `unknown element id "${op.elementId}" on slide "${op.slideId}"`
  const problem = lockedProblem(slide, slide.elements[i], ctx, 'removed')
  if (problem) return problem
  slide.elements.splice(i, 1)
  return null
}

function setMeta(deck: Draft<Deck>, op: OpOf<'setMeta'>): string | null {
  if (op.title !== undefined) deck.title = op.title
  if (op.meta) assignPatch(deck.meta, op.meta)
  return null
}

/** Applies one op to the draft. Returns an error message, or null on success. */
export function applyOp(deck: Draft<Deck>, op: DeckOp, ctx: OpContext): string | null {
  switch (op.op) {
    case 'insertSlides':
      return insertSlides(deck, op)
    case 'deleteSlides':
      return deleteSlides(deck, op)
    case 'moveSlide':
      return moveSlide(deck, op)
    case 'replaceSlide':
      return replaceSlide(deck, op, ctx)
    case 'updateSlide':
      return updateSlide(deck, op)
    case 'addElement':
      return addElement(deck, op)
    case 'updateElement':
      return updateElement(deck, op, ctx)
    case 'removeElement':
      return removeElement(deck, op, ctx)
    case 'setMeta':
      return setMeta(deck, op)
  }
}
