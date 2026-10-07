import { describe, expect, it } from 'vitest'
import { applyChangeSet } from '@shared/deck/apply'
import { fixtureDeck, makeSlide, makeText } from '@shared/deck/testing'
import type { Slide } from '@shared/deck/types'
import {
  addElementPlan,
  addSlidePlan,
  blankSlideLike,
  copyOfSlide,
  deleteSlidesPlan,
  duplicateSlidePlan,
  editTextPlan,
  moveElementPlan,
  moveSlidePlan,
  newTextBox,
  removeElementPlan,
  templateFor,
  type EditPlan
} from './changes'
import type { EditableElement } from './textEdit'

let counter = 0
const newId = (prefix: string): string => `${prefix}_${++counter}`

/** Applies a plan to the fixture deck the way main does. */
function run(plan: EditPlan) {
  const deck = fixtureDeck()
  const result = applyChangeSet(deck, {
    id: 'chg_t',
    by: 'user',
    summary: plan.summary,
    ops: plan.ops,
    at: '2026-10-06T10:00:00.000Z'
  })
  if (!result.ok) throw new Error(result.errors.join('; '))
  return result.deck
}

describe('moveSlidePlan', () => {
  it('moves a slide after another one in one op', () => {
    const plan = moveSlidePlan('s1', 's2')
    expect(plan.ops).toEqual([{ op: 'moveSlide', slideId: 's1', afterSlideId: 's2' }])
    expect(run(plan).slides.map((s) => s.id)).toEqual(['s2', 's1', 's3'])
  })

  it('moves a slide to the front with a null anchor', () => {
    expect(run(moveSlidePlan('s3', null)).slides.map((s) => s.id)).toEqual(['s3', 's1', 's2'])
  })
})

describe('deleteSlidesPlan', () => {
  it('names one slide in the singular and removes it', () => {
    const plan = deleteSlidesPlan(['s2'])
    expect(plan.summary).toBe('Deleted 1 slide')
    expect(run(plan).slides.map((s) => s.id)).toEqual(['s1', 's3'])
  })

  it('removes several slides in a single op', () => {
    const plan = deleteSlidesPlan(['s1', 's3'])
    expect(plan.ops).toHaveLength(1)
    expect(plan.summary).toBe('Deleted 2 slides')
    expect(run(plan).slides.map((s) => s.id)).toEqual(['s2'])
  })
})

describe('copyOfSlide and duplicateSlidePlan', () => {
  it('gives the copy fresh ids for the slide and every element, and marks it as the teacher’s', () => {
    const original = fixtureDeck().slides[1]
    const copy = copyOfSlide(original, newId)
    expect(copy.id).not.toBe(original.id)
    expect(copy.elements).toHaveLength(original.elements.length)
    const originalIds = new Set(original.elements.map((e) => e.id))
    expect(copy.elements.every((e) => !originalIds.has(e.id))).toBe(true)
    expect(copy.source).toEqual({ by: 'user' })
    // The original is untouched.
    expect(original.elements[0].id).toBe('s2-band')
  })

  it('inserts the copy right after the original and asks to select it', () => {
    const original = fixtureDeck().slides[0]
    const plan = duplicateSlidePlan(original, newId)
    expect(plan.summary).toBe('Duplicated a slide')
    const deck = run(plan)
    expect(deck.slides).toHaveLength(4)
    expect(deck.slides[1].id).toBe(plan.selectId)
    expect(deck.slides[0].id).toBe('s1')
  })
})

describe('blankSlideLike', () => {
  it('keeps locked decorations and empties the text boxes of the template', () => {
    const template = fixtureDeck().slides[2]
    const blank = blankSlideLike(template, newId)
    expect(blank.id).not.toBe(template.id)
    expect(blank.kind).toBe('content')
    const types = blank.elements.map((e) => e.type)
    expect(types).not.toContain('image')
    expect(types).not.toContain('chips')
    const texts = blank.elements.filter((e) => e.type === 'text' && !e.locked)
    expect(texts.length).toBeGreaterThan(0)
    for (const el of texts) {
      expect(el.type === 'text' && el.paragraphs).toEqual([{ runs: [{ text: '' }] }])
    }
    expect(blank.elements.some((e) => e.locked)).toBe(true)
  })

  it('falls back to a plain titled slide without a template', () => {
    const blank = blankSlideLike(undefined, newId)
    expect(blank.kind).toBe('content')
    expect(blank.elements.length).toBeGreaterThan(0)
  })
})

describe('addSlidePlan and templateFor', () => {
  it('inserts after the given slide and selects the new one', () => {
    const blank = makeSlide('blank')
    const plan = addSlidePlan('s1', blank)
    expect(plan.selectId).toBe('blank')
    expect(run(plan).slides.map((s) => s.id)).toEqual(['s1', 'blank', 's2', 's3'])
  })

  it('inserts first for a null anchor', () => {
    expect(run(addSlidePlan(null, makeSlide('blank'))).slides[0].id).toBe('blank')
  })

  it('uses the selected slide as the template when it is a content slide', () => {
    const slides: Slide[] = [makeSlide('a', { kind: 'title' }), makeSlide('b'), makeSlide('c')]
    expect(templateFor(slides, 'b')?.id).toBe('b')
  })

  it('falls back to the last content slide, then to the selected one', () => {
    const slides: Slide[] = [makeSlide('a', { kind: 'title' }), makeSlide('b'), makeSlide('c')]
    expect(templateFor(slides, 'a')?.id).toBe('c')
    const only: Slide[] = [makeSlide('a', { kind: 'title' })]
    expect(templateFor(only, 'a')?.id).toBe('a')
    expect(templateFor([], null)).toBeUndefined()
  })
})

describe('text edits', () => {
  it('editTextPlan updates the paragraphs of the element', () => {
    const slide = fixtureDeck().slides[0]
    const title = slide.elements.find((e) => e.id === 's1-title') as EditableElement
    const plan = editTextPlan(slide.id, title, 'Why do plants need light?')
    expect(plan.summary).toBe('Edited text')
    const deck = run(plan)
    const edited = deck.slides[0].elements.find((e) => e.id === 's1-title') as EditableElement
    expect(edited.paragraphs[0].runs.map((r) => r.text).join('')).toBe('Why do plants need light?')
  })

  it('newTextBox puts a body box at the point, kept on the slide', () => {
    const box = newTextBox({ x: 100.4, y: 200 }, 'one\ntwo', newId)
    expect(box).toMatchObject({ type: 'text', role: 'body', x: 100, y: 200, w: 800, h: 120 })
    expect(box.paragraphs.map((p) => p.runs[0].text)).toEqual(['one', 'two'])
    const edge = newTextBox({ x: 5000, y: 5000 }, 'x', newId)
    expect(edge.x).toBe(1920 - 800)
    expect(edge.y).toBe(1080 - 120)
    expect(newTextBox({ x: -10, y: -10 }, 'x', newId)).toMatchObject({ x: 0, y: 0 })
  })

  it('addElementPlan adds the box to the slide', () => {
    const box = newTextBox({ x: 10, y: 10 }, 'Hello', newId)
    const deck = run(addElementPlan('s1', box))
    expect(deck.slides[0].elements.some((e) => e.id === box.id)).toBe(true)
  })
})

describe('element moves and removal', () => {
  const element = makeText('el', 'x', { x: 100, y: 100, w: 400, h: 100 })

  it('moveElementPlan rounds and clamps to the slide', () => {
    expect(moveElementPlan('s', element, { x: 10.6, y: 20.2 }).ops).toEqual([
      { op: 'updateElement', slideId: 's', elementId: 'el', set: { x: 11, y: 20 } }
    ])
    const far = moveElementPlan('s', element, { x: 9999, y: -50 }).ops[0]
    expect(far).toMatchObject({ set: { x: 1920 - 400, y: 0 } })
  })

  it('removeElementPlan removes the element', () => {
    const plan = removeElementPlan('s1', 's1-kicker')
    expect(plan.summary).toBe('Deleted an element')
    expect(run(plan).slides[0].elements.some((e) => e.id === 's1-kicker')).toBe(false)
  })
})
