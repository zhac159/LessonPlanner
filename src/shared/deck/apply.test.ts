import { applyPatches } from 'immer'
import { describe, expect, it } from 'vitest'
import { applyChangeSet, type ApplyOptions } from './apply'
import { fixedClock, fixtureDeck, FIXED_NOW, makeChangeSet, makeSlide, makeText } from './testing'
import type { Deck, DeckOp, Element } from './types'

const opts: ApplyOptions = { clock: fixedClock }

/** Applies ops and returns the new deck, failing the test when rejected. */
function applyOk(deck: Deck, ops: DeckOp[], options: ApplyOptions = opts) {
  const r = applyChangeSet(deck, makeChangeSet(ops), options)
  if (!r.ok) throw new Error(`rejected: ${r.errors.join('; ')}`)
  return r
}

function rejected(deck: Deck, ops: DeckOp[], options: ApplyOptions = opts): string[] {
  const r = applyChangeSet(deck, makeChangeSet(ops), options)
  if (r.ok) throw new Error('expected rejection')
  return r.errors
}

const slideIds = (d: Deck) => d.slides.map((s) => s.id)
const element = (d: Deck, slide: string, id: string): Element | undefined =>
  d.slides.find((s) => s.id === slide)?.elements.find((e) => e.id === id)

describe('applyChangeSet: operations', () => {
  it('insertSlides at the start, after a slide and gives generated ids', () => {
    const deck = fixtureDeck()
    const out = applyOk(deck, [
      { op: 'insertSlides', afterSlideId: null, slides: [makeSlide('new-first')] },
      { op: 'insertSlides', afterSlideId: 's2', slides: [makeSlide('a'), makeSlide('b')] }
    ]).deck
    expect(slideIds(out)).toEqual(['new-first', 's1', 's2', 'a', 'b', 's3'])
  })

  it('insertSlides fills missing ids from raw AI input', () => {
    const raw = {
      id: 'c',
      by: 'ai',
      summary: 's',
      at: FIXED_NOW.toISOString(),
      ops: [{ op: 'insertSlides', afterSlideId: 's3', slides: [{ kind: 'plenary', elements: [] }] }]
    }
    const r = applyChangeSet(fixtureDeck(), raw as never, opts)
    expect(r.ok && r.deck.slides[3].id).toMatch(/^sld_/)
  })

  it('deleteSlides removes several slides', () => {
    expect(
      slideIds(applyOk(fixtureDeck(), [{ op: 'deleteSlides', slideIds: ['s1', 's3'] }]).deck)
    ).toEqual(['s2'])
  })

  it('deleteSlides tolerates duplicate ids and can empty the deck', () => {
    const out = applyOk(fixtureDeck(), [
      { op: 'deleteSlides', slideIds: ['s1', 's1', 's2', 's3'] }
    ]).deck
    expect(out.slides).toEqual([])
  })

  it('moveSlide to the start and after another slide', () => {
    const deck = fixtureDeck()
    expect(
      slideIds(applyOk(deck, [{ op: 'moveSlide', slideId: 's3', afterSlideId: null }]).deck)
    ).toEqual(['s3', 's1', 's2'])
    expect(
      slideIds(applyOk(deck, [{ op: 'moveSlide', slideId: 's1', afterSlideId: 's2' }]).deck)
    ).toEqual(['s2', 's1', 's3'])
  })

  it('replaceSlide swaps the content, keeping locked decorations', () => {
    const deck = fixtureDeck()
    const band = deck.slides[1].elements.find((e) => e.locked) as Element
    const replacement = makeSlide('s2', {
      kind: 'check',
      elements: [band, makeText('q', 'New question')]
    })
    const out = applyOk(deck, [{ op: 'replaceSlide', slide: replacement }]).deck
    expect(out.slides[1].kind).toBe('check')
    expect(out.slides[1].elements.map((e) => e.id)).toEqual([band.id, 'q'])
  })

  it('updateSlide sets kind, notes, layout and background; undefined clears', () => {
    const deck = fixtureDeck()
    const out = applyOk(deck, [
      {
        op: 'updateSlide',
        slideId: 's2',
        set: {
          kind: 'quiz',
          notes: 'Hello',
          layoutId: 'x',
          background: { color: 'token:highlight' }
        }
      }
    ]).deck
    expect(out.slides[1]).toMatchObject({ kind: 'quiz', notes: 'Hello', layoutId: 'x' })
    expect(out.slides[1].background).toEqual({ color: 'token:highlight' })
    const cleared = applyOk(out, [
      { op: 'updateSlide', slideId: 's2', set: { notes: undefined } }
    ]).deck
    expect('notes' in cleared.slides[1]).toBe(false)
  })

  it('addElement appends (painted on top)', () => {
    const out = applyOk(fixtureDeck(), [
      { op: 'addElement', slideId: 's1', element: makeText('extra', 'Hi') }
    ]).deck
    expect(out.slides[0].elements.at(-1)?.id).toBe('extra')
  })

  it('updateElement shallow-merges and replaces arrays whole', () => {
    const out = applyOk(fixtureDeck(), [
      {
        op: 'updateElement',
        slideId: 's3',
        elementId: 's3-keywords',
        set: { items: ['one', 'two'], x: 200 } as never
      },
      { op: 'updateElement', slideId: 's3', elementId: 's3-los', set: { align: 'center' } }
    ]).deck
    const chips = element(out, 's3', 's3-keywords')
    expect(chips).toMatchObject({ items: ['one', 'two'], x: 200, y: 740 })
    expect(element(out, 's3', 's3-los')).toMatchObject({ align: 'center', role: 'body' })
  })

  it('updateElement with undefined removes an optional property', () => {
    const out = applyOk(fixtureDeck(), [
      { op: 'updateElement', slideId: 's1', elementId: 's1-title', set: { fontSizePt: undefined } }
    ]).deck
    expect(element(out, 's1', 's1-title')).not.toHaveProperty('fontSizePt')
  })

  it('removeElement removes it', () => {
    const out = applyOk(fixtureDeck(), [
      { op: 'removeElement', slideId: 's3', elementId: 's3-photo' }
    ]).deck
    expect(element(out, 's3', 's3-photo')).toBeUndefined()
  })

  it('setMeta changes the title and merges meta', () => {
    const out = applyOk(fixtureDeck(), [
      { op: 'setMeta', title: 'New', meta: { durationMin: 60, objectives: ['a'] } }
    ]).deck
    expect(out.title).toBe('New')
    expect(out.meta).toMatchObject({ durationMin: 60, objectives: ['a'], subject: 'Science' })
  })

  it('applies ops in order within one ChangeSet (insert then edit the new slide)', () => {
    const out = applyOk(fixtureDeck(), [
      { op: 'insertSlides', afterSlideId: 's3', slides: [makeSlide('n')] },
      { op: 'addElement', slideId: 'n', element: makeText('t', 'Hello') },
      { op: 'updateElement', slideId: 'n', elementId: 't', set: { y: 300 } }
    ]).deck
    expect(element(out, 'n', 't')).toMatchObject({ y: 300 })
  })
})

describe('applyChangeSet: rejections (whole ChangeSet, deck untouched)', () => {
  it.each<[string, DeckOp, RegExp]>([
    [
      'insert after unknown slide',
      { op: 'insertSlides', afterSlideId: 'nope', slides: [makeSlide('z')] },
      /unknown slide id "nope"/
    ],
    [
      'insert a duplicate slide id',
      { op: 'insertSlides', afterSlideId: null, slides: [makeSlide('s1')] },
      /already exists/
    ],
    [
      'insert duplicate ids within the op',
      { op: 'insertSlides', afterSlideId: null, slides: [makeSlide('z'), makeSlide('z')] },
      /already exists/
    ],
    [
      'delete unknown slide',
      { op: 'deleteSlides', slideIds: ['s1', 'nope'] },
      /unknown slide id\(s\): "nope"/
    ],
    [
      'move unknown slide',
      { op: 'moveSlide', slideId: 'nope', afterSlideId: null },
      /unknown slide id "nope"/
    ],
    [
      'move after unknown slide',
      { op: 'moveSlide', slideId: 's1', afterSlideId: 'nope' },
      /afterSlideId/
    ],
    ['move after itself', { op: 'moveSlide', slideId: 's1', afterSlideId: 's1' }, /after itself/],
    [
      'replace unknown slide',
      { op: 'replaceSlide', slide: makeSlide('nope') },
      /unknown slide id "nope"/
    ],
    [
      'update unknown slide',
      { op: 'updateSlide', slideId: 'nope', set: { notes: 'x' } },
      /unknown slide id/
    ],
    [
      'add to unknown slide',
      { op: 'addElement', slideId: 'nope', element: makeText('a', 'x') },
      /unknown slide id/
    ],
    [
      'add a duplicate element id',
      { op: 'addElement', slideId: 's1', element: makeText('s1-title', 'x') },
      /already exists on slide/
    ],
    [
      'update unknown element',
      { op: 'updateElement', slideId: 's1', elementId: 'nope', set: { x: 1 } },
      /unknown element id "nope"/
    ],
    [
      'remove unknown element',
      { op: 'removeElement', slideId: 's1', elementId: 'nope' },
      /unknown element id/
    ],
    [
      'remove from unknown slide',
      { op: 'removeElement', slideId: 'nope', elementId: 'x' },
      /unknown slide id/
    ]
  ])('%s', (_name, op, message) => {
    const deck = fixtureDeck()
    const errors = rejected(deck, [op])
    expect(errors[0]).toMatch(message)
    expect(errors[0]).toMatch(/^ops\[0\] \(/)
    expect(deck).toEqual(fixtureDeck())
  })

  it('rejects the whole ChangeSet when only a later op is bad, and reports every error', () => {
    const deck = fixtureDeck()
    const errors = rejected(deck, [
      { op: 'setMeta', title: 'Changed' },
      { op: 'removeElement', slideId: 's1', elementId: 'nope' },
      { op: 'deleteSlides', slideIds: ['ghost'] }
    ])
    expect(errors).toHaveLength(2)
    expect(errors[0]).toMatch(/^ops\[1\]/)
    expect(errors[1]).toMatch(/^ops\[2\]/)
  })

  it('rejects updateElement results that are invalid for the element type', () => {
    const errors = rejected(fixtureDeck(), [
      { op: 'updateElement', slideId: 's1', elementId: 's1-title', set: { x: 'wide' } as never }
    ])
    expect(errors[0]).toMatch(/invalid update of element "s1-title": x:/)
  })

  it('rejects updateElement properties the element type does not have', () => {
    const errors = rejected(fixtureDeck(), [
      { op: 'updateElement', slideId: 's1', elementId: 's1-title', set: { items: ['a'] } as never }
    ])
    expect(errors[0]).toMatch(/is a text and has no property items/)
  })

  it('rejects empty and malformed ChangeSets', () => {
    expect(applyChangeSet(fixtureDeck(), makeChangeSet([]), opts)).toEqual({
      ok: false,
      errors: ['The change set has no operations']
    })
    const bad = applyChangeSet(fixtureDeck(), { id: 'x' } as never, opts)
    expect(bad.ok).toBe(false)
  })

  it('rejects diagram updates with an unusable SVG', () => {
    const deck = applyOk(fixtureDeck(), [
      {
        op: 'addElement',
        slideId: 's1',
        element: {
          id: 'dia',
          type: 'diagram',
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          alt: 'd',
          svg: '<svg viewBox="0 0 1 1"/>'
        }
      }
    ]).deck
    const errors = rejected(deck, [
      { op: 'updateElement', slideId: 's1', elementId: 'dia', set: { svg: '<svg/>' } as never }
    ])
    expect(errors[0]).toMatch(/viewBox/)
  })
})

describe('applyChangeSet: locked elements', () => {
  it('cannot be removed', () => {
    expect(
      rejected(fixtureDeck(), [{ op: 'removeElement', slideId: 's1', elementId: 's1-band' }])[0]
    ).toMatch(/locked/)
  })

  it.each(['x', 'y', 'w', 'h', 'rotation', 'locked'])('cannot change %s', (key) => {
    const set = { [key]: key === 'locked' ? false : 5 } as never
    expect(
      rejected(fixtureDeck(), [
        { op: 'updateElement', slideId: 's1', elementId: 's1-band', set }
      ])[0]
    ).toMatch(/locked/)
  })

  it('can still be restyled (fill) and renamed', () => {
    const out = applyOk(fixtureDeck(), [
      {
        op: 'updateElement',
        slideId: 's1',
        elementId: 's1-band',
        set: { fill: { color: 'token:highlight' }, name: 'band' } as never
      }
    ]).deck
    expect(element(out, 's1', 's1-band')).toMatchObject({
      name: 'band',
      fill: { color: 'token:highlight' }
    })
  })

  it('is removable and movable with allowLocked', () => {
    const allow: ApplyOptions = { ...opts, allowLocked: true }
    const moved = applyOk(
      fixtureDeck(),
      [{ op: 'updateElement', slideId: 's1', elementId: 's1-band', set: { w: 40 } }],
      allow
    ).deck
    expect(element(moved, 's1', 's1-band')).toMatchObject({ w: 40 })
    const gone = applyOk(
      fixtureDeck(),
      [{ op: 'removeElement', slideId: 's1', elementId: 's1-band' }],
      allow
    ).deck
    expect(element(gone, 's1', 's1-band')).toBeUndefined()
  })

  it('must be kept (unmoved) by replaceSlide unless allowed', () => {
    const deck = fixtureDeck()
    const band = deck.slides[0].elements[0]
    const without = makeSlide('s1', { elements: [makeText('t', 'x')] })
    expect(rejected(deck, [{ op: 'replaceSlide', slide: without }])[0]).toMatch(
      /locked element "s1-band"/
    )
    const moved = makeSlide('s1', { elements: [{ ...band, x: 10 }] })
    expect(rejected(deck, [{ op: 'replaceSlide', slide: moved }])[0]).toMatch(/locked element/)
    const unlocked = makeSlide('s1', { elements: [{ ...band, locked: false }] })
    expect(rejected(deck, [{ op: 'replaceSlide', slide: unlocked }])[0]).toMatch(/locked element/)
    expect(
      applyOk(deck, [{ op: 'replaceSlide', slide: without }], { ...opts, allowLocked: true }).deck
        .slides[0].elements
    ).toHaveLength(1)
  })

  it('go away with their slide when the slide is deleted', () => {
    expect(
      applyOk(fixtureDeck(), [{ op: 'deleteSlides', slideIds: ['s1'] }]).deck.slides
    ).toHaveLength(2)
  })
})

describe('applyChangeSet: normalisation, clock, immutability', () => {
  it('clamps boxes, drops empty runs and fixes duplicate element ids after the ops', () => {
    const out = applyOk(fixtureDeck(), [
      {
        op: 'addElement',
        slideId: 's2',
        element: makeText('big', 'x', {
          x: 1800,
          y: 1000,
          w: 500,
          h: 400,
          paragraphs: [{ runs: [{ text: '' }, { text: 'k' }] }]
        })
      }
    ]).deck
    const el = element(out, 's2', 'big')
    expect(el).toMatchObject({ x: 1420, y: 680 })
    expect(el?.type === 'text' && el.paragraphs[0].runs).toEqual([{ text: 'k' }])
  })

  it('bumps updatedAt with the injected clock', () => {
    const out = applyOk(fixtureDeck(), [{ op: 'setMeta', title: 'T' }]).deck
    expect(out.updatedAt).toBe(FIXED_NOW.toISOString())
  })

  it('defaults to the real clock', () => {
    const before = Date.now()
    const r = applyChangeSet(fixtureDeck(), makeChangeSet([{ op: 'setMeta', title: 'T' }]))
    expect(r.ok && Date.parse(r.deck.updatedAt)).toBeGreaterThanOrEqual(before)
  })

  it('never mutates the input deck or the ChangeSet', () => {
    const deck = fixtureDeck()
    const cs = makeChangeSet([
      {
        op: 'insertSlides',
        afterSlideId: 's1',
        slides: [makeSlide('n', { elements: [makeText('t', 'x')] })]
      }
    ])
    const csCopy = structuredClone(cs)
    const r = applyChangeSet(deck, cs, opts)
    expect(r.ok).toBe(true)
    expect(deck).toEqual(fixtureDeck())
    expect(cs).toEqual(csCopy)
    expect(Object.isFrozen(cs.ops[0])).toBe(false)
  })

  it('returns the validated ChangeSet with generated ids filled in', () => {
    const cs = makeChangeSet([
      {
        op: 'addElement',
        slideId: 's1',
        element: { type: 'chips', x: 0, y: 0, w: 10, h: 10, items: ['a'] } as never
      }
    ])
    const r = applyChangeSet(fixtureDeck(), cs, opts)
    if (!r.ok) throw new Error('rejected')
    const op = r.changeSet.ops[0]
    expect(op.op === 'addElement' && r.deck.slides[0].elements.at(-1)?.id === op.element.id).toBe(
      true
    )
  })

  it('structurally shares untouched slides', () => {
    const deck = fixtureDeck()
    const out = applyOk(deck, [{ op: 'updateSlide', slideId: 's2', set: { notes: 'n' } }]).deck
    expect(out.slides[0]).toBe(deck.slides[0])
    expect(out.slides[2]).toBe(deck.slides[2])
    expect(out.slides[1]).not.toBe(deck.slides[1])
  })
})

describe('applyChangeSet: patches', () => {
  const sample: DeckOp[][] = [
    [
      {
        op: 'insertSlides',
        afterSlideId: 's1',
        slides: [makeSlide('n', { elements: [makeText('t', 'x')] })]
      }
    ],
    [{ op: 'deleteSlides', slideIds: ['s2'] }],
    [{ op: 'moveSlide', slideId: 's3', afterSlideId: null }],
    [
      {
        op: 'updateElement',
        slideId: 's3',
        elementId: 's3-keywords',
        set: { items: ['q'] } as never
      }
    ],
    [{ op: 'removeElement', slideId: 's3', elementId: 's3-photo' }],
    [{ op: 'setMeta', title: 'Renamed', meta: { subject: 'Biology' } }],
    [
      { op: 'addElement', slideId: 's1', element: makeText('a', 'A') },
      { op: 'updateSlide', slideId: 's1', set: { notes: 'N' } },
      { op: 'removeElement', slideId: 's1', elementId: 'a' }
    ]
  ]

  it.each(sample.map((ops) => [ops.map((o) => o.op).join('+'), ops] as const))(
    'inverse patches restore the original exactly: %s',
    (_name, ops) => {
      const deck = fixtureDeck()
      const r = applyOk(deck, [...ops])
      expect(r.deck).not.toEqual(deck)
      expect(applyPatches(r.deck, r.inversePatches)).toEqual(deck)
      expect(applyPatches(deck, r.patches)).toEqual(r.deck)
    }
  )

  it('keeps patches small for the common edit (one property), not the whole slide', () => {
    const r = applyOk(fixtureDeck(), [
      { op: 'updateElement', slideId: 's3', elementId: 's3-keywords', set: { x: 200 } }
    ])
    expect(JSON.stringify(r.patches).length).toBeLessThan(250)
    expect(JSON.stringify(r.inversePatches).length).toBeLessThan(250)
  })
})
