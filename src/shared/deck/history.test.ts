import { describe, expect, it } from 'vitest'
import { applyChangeSet, type ApplyOptions } from './apply'
import {
  applyChangeSetsGrouped,
  changeLine,
  DeckHistory,
  groupChangeSets,
  REDO_LINE,
  UNDO_LINE,
  type HistoryEntry
} from './history'
import { fixedClock, fixtureDeck, makeChangeSet, makeSlide, makeText } from './testing'
import type { ChangeSet, Deck } from './types'

const opts: ApplyOptions = { clock: fixedClock }
const later = (): Date => new Date('2026-10-07T09:00:00.000Z')

/** Applies a ChangeSet and records it; returns the new deck and the entry. */
function step(history: DeckHistory, deck: Deck, cs: ChangeSet) {
  const r = applyChangeSet(deck, cs, opts)
  if (!r.ok) throw new Error(r.errors.join('; '))
  const entry: HistoryEntry = {
    changeSet: r.changeSet,
    patches: r.patches,
    inversePatches: r.inversePatches
  }
  history.record(entry)
  return { deck: r.deck, entry }
}

const rename = (title: string) =>
  makeChangeSet([{ op: 'setMeta', title }], { summary: `Rename ${title}` })
const withoutStamp = (d: Deck): Deck => ({ ...d, updatedAt: '' })

describe('DeckHistory undo/redo', () => {
  it('undoes and redoes a sequence of changes, deck-equal each time', () => {
    const history = new DeckHistory({ clock: later })
    const d0 = fixtureDeck()
    const d1 = step(history, d0, rename('One')).deck
    const d2 = step(history, d1, rename('Two')).deck
    const d3 = step(
      history,
      d2,
      makeChangeSet([
        { op: 'deleteSlides', slideIds: ['s2'] },
        { op: 'removeElement', slideId: 's3', elementId: 's3-photo' }
      ])
    ).deck

    const u3 = history.undo(d3)
    expect(u3.ok && withoutStamp(u3.deck)).toEqual(withoutStamp(d2))
    const u2 = history.undo(u3.ok ? u3.deck : d3)
    expect(u2.ok && withoutStamp(u2.deck)).toEqual(withoutStamp(d1))
    const u1 = history.undo(u2.ok ? u2.deck : d3)
    expect(u1.ok && withoutStamp(u1.deck)).toEqual(withoutStamp(d0))
    expect(history.canUndo).toBe(false)

    const r1 = history.redo(u1.ok ? u1.deck : d3)
    expect(r1.ok && withoutStamp(r1.deck)).toEqual(withoutStamp(d1))
    expect(history.canRedo).toBe(true)
  })

  it('reports nothing to undo/redo on an empty history', () => {
    const history = new DeckHistory()
    expect(history.undo(fixtureDeck())).toEqual({ ok: false, error: 'Nothing to undo' })
    expect(history.redo(fixtureDeck())).toEqual({ ok: false, error: 'Nothing to redo' })
    expect(history.nextUndoSummary).toBeNull()
    expect(history.nextRedoSummary).toBeNull()
  })

  it('clears the redo stack when a new change arrives', () => {
    const history = new DeckHistory({ clock: later })
    const d1 = step(history, fixtureDeck(), rename('One')).deck
    const undone = history.undo(d1)
    if (!undone.ok) throw new Error('undo failed')
    expect(history.canRedo).toBe(true)
    step(history, undone.deck, rename('Other'))
    expect(history.canRedo).toBe(false)
    expect(history.redo(undone.deck).ok).toBe(false)
  })

  it('bumps updatedAt on undo and redo using the clock', () => {
    const history = new DeckHistory({ clock: later })
    const d1 = step(history, fixtureDeck(), rename('One')).deck
    const undone = history.undo(d1)
    expect(undone.ok && undone.deck.updatedAt).toBe(later().toISOString())
    const redone = history.redo(undone.ok ? undone.deck : d1)
    expect(redone.ok && redone.deck.updatedAt).toBe(later().toISOString())
  })

  it('exposes the summary of the next undo/redo', () => {
    const history = new DeckHistory({ clock: later })
    const d1 = step(history, fixtureDeck(), rename('One')).deck
    expect(history.nextUndoSummary).toBe('Rename One')
    history.undo(d1)
    expect(history.nextRedoSummary).toBe('Rename One')
    expect(history.nextUndoSummary).toBeNull()
  })

  it('caps the undo stack at the limit, dropping the oldest', () => {
    const history = new DeckHistory({ limit: 2 })
    let deck = fixtureDeck()
    for (const t of ['A', 'B', 'C']) deck = step(history, deck, rename(t)).deck
    const first = history.undo(deck)
    const second = history.undo(first.ok ? first.deck : deck)
    expect(second.ok && second.deck.title).toBe('A')
    expect(history.canUndo).toBe(false)
  })

  it('fails safely, leaving the stacks alone, when the deck no longer matches the patches', () => {
    const history = new DeckHistory({ clock: later })
    const d1 = step(
      history,
      fixtureDeck(),
      makeChangeSet([
        { op: 'updateElement', slideId: 's3', elementId: 's3-keywords', set: { x: 200 } }
      ])
    ).deck
    const wrong = { ...d1, slides: [] }
    const r = history.undo(wrong)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/no longer matches/)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })
})

describe('journal (changes.jsonl) persistence', () => {
  /** Simulates the service: every action appends a line. */
  function session() {
    const history = new DeckHistory({ clock: later })
    const lines: string[] = []
    let deck = fixtureDeck()
    const change = (cs: ChangeSet) => {
      const { deck: next, entry } = step(history, deck, cs)
      deck = next
      lines.push(changeLine(entry))
    }
    const undo = () => {
      const r = history.undo(deck)
      if (!r.ok) throw new Error(r.error)
      deck = r.deck
      lines.push(UNDO_LINE)
    }
    const redo = () => {
      const r = history.redo(deck)
      if (!r.ok) throw new Error(r.error)
      deck = r.deck
      lines.push(REDO_LINE)
    }
    return {
      change,
      undo,
      redo,
      lines,
      get deck() {
        return deck
      }
    }
  }

  it('lets undo work after a restart, down to the original deck', () => {
    const s = session()
    s.change(rename('One'))
    s.change(
      makeChangeSet([
        {
          op: 'insertSlides',
          afterSlideId: 's1',
          slides: [makeSlide('n', { elements: [makeText('t', 'x')] })]
        }
      ])
    )
    const saved = s.deck

    const { history, skipped } = DeckHistory.fromJournal(s.lines, { clock: later })
    expect(skipped).toBe(0)
    let deck = saved
    for (let i = 0; i < 2; i++) {
      const r = history.undo(deck)
      if (!r.ok) throw new Error(r.error)
      deck = r.deck
    }
    expect(withoutStamp(deck)).toEqual(withoutStamp(fixtureDeck()))
    expect(history.canUndo).toBe(false)
  })

  it('restores the redo stack from undo/redo markers', () => {
    const s = session()
    s.change(rename('One'))
    s.change(rename('Two'))
    s.change(rename('Three'))
    s.undo()
    s.undo()
    s.redo()

    const { history } = DeckHistory.fromJournal(s.lines, { clock: later })
    expect(history.nextUndoSummary).toBe('Rename Two')
    expect(history.nextRedoSummary).toBe('Rename Three')
    const redone = history.redo(s.deck)
    expect(redone.ok && redone.deck.title).toBe('Three')
  })

  it('round-trips JSON: one line per entry with no newlines', () => {
    const s = session()
    s.change(rename('One'))
    expect(s.lines[0]).not.toContain('\n')
    expect(JSON.parse(s.lines[0])).toMatchObject({
      v: 1,
      kind: 'change',
      changeSet: { summary: 'Rename One' }
    })
    expect(JSON.parse(UNDO_LINE)).toEqual({ v: 1, kind: 'undo' })
  })

  it('skips blank, corrupt and orphan marker lines and counts the bad ones', () => {
    const s = session()
    s.change(rename('One'))
    const lines = [
      '',
      '{not json',
      JSON.stringify({ v: 1, kind: 'change', changeSet: {} }),
      REDO_LINE,
      ...s.lines,
      '   '
    ]
    const { history, skipped } = DeckHistory.fromJournal(lines)
    expect(skipped).toBe(3)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  it('a recorded change after undo markers discards the redo (as live)', () => {
    const s = session()
    s.change(rename('One'))
    s.undo()
    s.change(rename('Other'))
    const { history } = DeckHistory.fromJournal(s.lines)
    expect(history.canRedo).toBe(false)
    expect(history.nextUndoSummary).toBe('Rename Other')
  })
})

describe('groupChangeSets / applyChangeSetsGrouped', () => {
  const generation = (): ChangeSet[] => [
    makeChangeSet([
      {
        op: 'insertSlides',
        afterSlideId: 's3',
        slides: [makeSlide('g1', { elements: [makeText('a', 'A')] })]
      }
    ]),
    makeChangeSet([{ op: 'insertSlides', afterSlideId: 'g1', slides: [makeSlide('g2')] }]),
    makeChangeSet([
      { op: 'addElement', slideId: 'g2', element: makeText('b', 'B') },
      { op: 'setMeta', title: 'Generated' }
    ])
  ]

  it('applies a whole generation as ONE undo step', () => {
    const deck = fixtureDeck()
    const r = applyChangeSetsGrouped(
      deck,
      generation(),
      { id: 'gen_1', summary: 'Made 2 slides' },
      opts
    )
    if (!r.ok) throw new Error(r.errors.join('; '))
    expect(r.deck.slides.map((s) => s.id)).toEqual(['s1', 's2', 's3', 'g1', 'g2'])
    expect(r.entry.changeSet).toMatchObject({ id: 'gen_1', summary: 'Made 2 slides', by: 'ai' })
    expect(r.entry.changeSet.ops).toHaveLength(4)

    const history = new DeckHistory({ clock: later })
    history.record(r.entry)
    const undone = history.undo(r.deck)
    expect(undone.ok && withoutStamp(undone.deck)).toEqual(withoutStamp(deck))
    expect(history.canUndo).toBe(false)
    const redone = history.redo(undone.ok ? undone.deck : deck)
    expect(redone.ok && redone.deck.slides).toHaveLength(5)
  })

  it('survives the journal round trip as a single line', () => {
    const r = applyChangeSetsGrouped(
      fixtureDeck(),
      generation(),
      { id: 'gen_1', summary: 'Gen' },
      opts
    )
    if (!r.ok) throw new Error('rejected')
    const { history } = DeckHistory.fromJournal([changeLine(r.entry)], { clock: later })
    const undone = history.undo(r.deck)
    expect(undone.ok && undone.deck.slides).toHaveLength(3)
  })

  it('is all or nothing and reports which ChangeSet failed', () => {
    const sets = generation()
    sets[1] = makeChangeSet([{ op: 'deleteSlides', slideIds: ['nope'] }])
    const r = applyChangeSetsGrouped(fixtureDeck(), sets, { id: 'g', summary: 's' }, opts)
    expect(r).toMatchObject({ ok: false, failedIndex: 1 })
  })

  it('rejects an empty generation', () => {
    expect(applyChangeSetsGrouped(fixtureDeck(), [], { id: 'g', summary: 's' }, opts).ok).toBe(
      false
    )
    expect(() => groupChangeSets([], { id: 'g', summary: 's' })).toThrow(/at least one/)
  })

  it('keeps the actor of the first entry and the time of the last unless overridden', () => {
    const deck = fixtureDeck()
    const a = applyChangeSet(
      deck,
      makeChangeSet([{ op: 'setMeta', title: 'A' }], {
        by: 'plugin',
        pluginId: 'p1',
        at: '2026-01-01T00:00:00.000Z'
      }),
      opts
    )
    if (!a.ok) throw new Error('rejected')
    const b = applyChangeSet(
      a.deck,
      makeChangeSet([{ op: 'setMeta', title: 'B' }], { at: '2026-02-02T00:00:00.000Z' }),
      opts
    )
    if (!b.ok) throw new Error('rejected')
    const entries = [a, b].map((r) => ({
      changeSet: r.changeSet,
      patches: r.patches,
      inversePatches: r.inversePatches
    }))
    expect(groupChangeSets(entries, { id: 'g', summary: 's' }).changeSet).toMatchObject({
      by: 'plugin',
      pluginId: 'p1',
      at: '2026-02-02T00:00:00.000Z'
    })
    expect(groupChangeSets(entries, { id: 'g', summary: 's', at: 'X' }).changeSet.at).toBe('X')
  })
})
