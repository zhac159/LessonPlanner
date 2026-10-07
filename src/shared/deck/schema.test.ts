import { describe, expect, it } from 'vitest'
import { parseChangeSet, parseDeck, parseDeckOps, SLIDE_KINDS } from './schema'
import { fixtureDeck, makeChangeSet, makeSlide, makeText } from './testing'

type Loose = Record<string, unknown>
const slidesOf = (deck: unknown) => (deck as { slides: Loose[] }).slides

describe('parseDeck', () => {
  it('accepts the photosynthesis fixture unchanged', () => {
    const deck = fixtureDeck()
    const r = parseDeck(deck)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual(deck)
  })

  it('does not alias the input (returns fresh objects)', () => {
    const deck = fixtureDeck()
    const r = parseDeck(deck)
    if (!r.ok) throw new Error('expected ok')
    expect(r.value).not.toBe(deck)
    expect(r.value.slides[0]).not.toBe(deck.slides[0])
  })

  it('reports readable paths for invalid input', () => {
    const deck = fixtureDeck()
    ;(deck.slides[1].elements[0] as unknown as Loose).x = 'left'
    const r = parseDeck(deck)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('invalid-input')
      expect(r.errors.some((e) => e.startsWith('slides.1.elements.0.x'))).toBe(true)
    }
  })

  it.each([
    ['wrong schemaVersion', (d: Loose) => (d.schemaVersion = 2)],
    ['wrong slide size', (d: Loose) => (d.size = { width: 1280, height: 720 })],
    ['missing slide id', (d: Loose) => delete slidesOf(d)[0].id],
    ['unknown slide kind', (d: Loose) => (slidesOf(d)[0].kind = 'party')],
    [
      'bad colour',
      (d: Loose) => {
        const el = (slidesOf(d)[0].elements as Loose[])[0]
        el.fill = { color: 'red' }
      }
    ]
  ])('rejects %s', (_name, mutate) => {
    const deck = fixtureDeck() as unknown as Loose
    mutate(deck)
    expect(parseDeck(deck).ok).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(parseDeck(null).ok).toBe(false)
    expect(parseDeck('deck').ok).toBe(false)
  })

  it('accepts every slide kind', () => {
    expect(SLIDE_KINDS).toHaveLength(15)
    for (const kind of SLIDE_KINDS) {
      const deck = { ...fixtureDeck(), slides: [makeSlide('s', { kind })] }
      expect(parseDeck(deck).ok).toBe(true)
    }
  })

  it('sanitises diagram SVG and rejects unusable SVG', () => {
    const diagram = {
      id: 'd',
      type: 'diagram',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      alt: 'a',
      svg: '<svg viewBox="0 0 1 1"><script>x</script><rect width="1" height="1"/></svg>'
    }
    const withSvg = (svg: string) => ({
      ...fixtureDeck(),
      slides: [makeSlide('s', { elements: [{ ...diagram, svg } as never] })]
    })
    const r = parseDeck(withSvg(diagram.svg))
    expect(r.ok).toBe(true)
    expect(r.ok && JSON.stringify(r.value)).not.toContain('script')
    expect(parseDeck(withSvg('<svg/>')).ok).toBe(false)
  })
})

describe('parseDeckOps / parseChangeSet', () => {
  const chips = { type: 'chips', x: 0, y: 0, w: 10, h: 10, items: ['a'] }

  it('fills missing slide and element ids', () => {
    const r = parseDeckOps([
      { op: 'insertSlides', afterSlideId: null, slides: [{ kind: 'content', elements: [chips] }] },
      { op: 'addElement', slideId: 's1', element: chips }
    ])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [insert, add] = r.value
    if (insert.op !== 'insertSlides' || add.op !== 'addElement') throw new Error('unexpected ops')
    expect(insert.slides[0].id).toMatch(/^sld_/)
    expect(insert.slides[0].elements[0].id).toMatch(/^el_/)
    expect(add.element.id).toMatch(/^el_/)
  })

  it('keeps ids that are present', () => {
    const r = parseDeckOps([{ op: 'addElement', slideId: 's1', element: makeText('keep', 'x') }])
    expect(r.ok && r.value[0].op === 'addElement' && r.value[0].element.id).toBe('keep')
  })

  it('rejects unknown ops, empty lists and malformed ops', () => {
    expect(parseDeckOps([{ op: 'explode' }]).ok).toBe(false)
    expect(parseDeckOps([{ op: 'deleteSlides', slideIds: [] }]).ok).toBe(false)
    expect(parseDeckOps([{ op: 'removeElement', slideId: 's1' }]).ok).toBe(false)
    expect(parseDeckOps('nope').ok).toBe(false)
  })

  it('rejects updateElement patches that try to change id or type', () => {
    const op = (set: unknown) => ({ op: 'updateElement', slideId: 's', elementId: 'e', set })
    expect(parseDeckOps([op({ x: 5 })]).ok).toBe(true)
    expect(parseDeckOps([op({ id: 'z' })]).ok).toBe(false)
    expect(parseDeckOps([op({ type: 'chips' })]).ok).toBe(false)
    expect(parseDeckOps([op([])]).ok).toBe(false)
  })

  it('validates colours in updateSlide backgrounds', () => {
    const op = (color: string) => ({
      op: 'updateSlide',
      slideId: 's',
      set: { background: { color } }
    })
    expect(parseDeckOps([op('token:accent')]).ok).toBe(true)
    expect(parseDeckOps([op('#fff')]).ok).toBe(true)
    expect(parseDeckOps([op('blue')]).ok).toBe(false)
  })

  it('parses a whole ChangeSet and rejects one with a bad op or actor', () => {
    const cs = makeChangeSet([{ op: 'setMeta', title: 'New title' }])
    const r = parseChangeSet(cs)
    expect(r.ok && r.value.summary).toBe(cs.summary)
    expect(parseChangeSet({ ...cs, by: 'robot' }).ok).toBe(false)
    expect(parseChangeSet({ ...cs, ops: [{ op: 'nope' }] }).ok).toBe(false)
  })
})
