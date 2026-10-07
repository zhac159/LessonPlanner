/** The pure parts of generation: the worker pool, brief merging and the commit's ChangeSets. */
import { describe, expect, it } from 'vitest'
import type { LessonPlan } from '@shared/ai/types'
import { applyChangeSetsGrouped } from '@shared/deck/history'
import { fixtureDeck, makeSlide } from '@shared/deck/testing'
import type { Deck } from '@shared/deck/types'
import { sequentialIds, steppingClock } from '../lessons/testing'
import { generationChangeSets, metaFrom, presentSlideIds } from './commit'
import { mergeBrief } from './planner'
import { runPool } from './pool'
import { sleep } from './testing'

describe('runPool', () => {
  it('runs the first item alone, then the rest with at most `limit` in flight', async () => {
    let inFlight = 0
    let max = 0
    const events: string[] = []
    await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      events.push(`start ${n} (${inFlight} already)`)
      max = Math.max(max, ++inFlight)
      await sleep(10)
      inFlight--
      return 'continue'
    })
    expect(events[0]).toBe('start 1 (0 already)')
    expect(events[1]).toMatch(/^start 2 \(0 already\)/)
    expect(max).toBe(3)
  })

  it('processes every item exactly once', async () => {
    const seen: number[] = []
    await runPool([1, 2, 3, 4, 5], 2, async (n) => (seen.push(n), 'continue'))
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('starts nothing new after a worker says stop, but lets running ones finish', async () => {
    const started: number[] = []
    const finished: number[] = []
    await runPool([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
      started.push(n)
      await sleep(n === 3 ? 5 : 20)
      finished.push(n)
      return n === 3 ? 'stop' : 'continue'
    })
    expect(started.length).toBeLessThan(8)
    expect(finished.sort()).toEqual(started.sort())
  })

  it('stops at once when the first item says stop, and treats a throwing worker as stop', async () => {
    const started: number[] = []
    await runPool([1, 2, 3], 3, async (n) => (started.push(n), 'stop'))
    expect(started).toEqual([1])
    const after: number[] = []
    await runPool([1, 2, 3, 4], 1, async (n) => {
      after.push(n)
      if (n === 2) throw new Error('boom')
      return 'continue'
    })
    expect(after).toEqual([1, 2])
  })

  it('handles empty input and limits below one', async () => {
    await runPool([], 3, async () => 'continue')
    const seen: number[] = []
    await runPool([1, 2, 3], 0, async (n) => (seen.push(n), 'continue'))
    expect(seen.sort()).toEqual([1, 2, 3])
  })
})

describe('mergeBrief', () => {
  const extraction = (over = {}) => ({ title: 'T', objectives: ['A', 'B'], ...over })

  it('merges objectives without duplicates and takes the first title, subject and year', () => {
    const brief = mergeBrief({ lessonId: 'l', text: 't', documentIds: [], meta: {} }, [
      extraction({ objectives: ['A', ' B '], subject: 'Science' }),
      extraction({ title: 'Second', objectives: ['B', 'C'], yearGroup: 'Y8' })
    ])
    expect(brief).toEqual({
      title: 'T',
      subject: 'Science',
      yearGroup: 'Y8',
      objectives: ['A', 'B', 'C']
    })
  })

  it('lets the teacher’s set-up and a typed title win', () => {
    const brief = mergeBrief(
      {
        lessonId: 'l',
        text: 't',
        documentIds: [],
        typedTitle: 'Mine',
        meta: {
          subject: 'Maths',
          yearGroup: 'Y9',
          durationMin: 40,
          ability: 'Set 3',
          targetSlideCount: 6,
          context: 'No calculators'
        }
      },
      [extraction({ subject: 'Science', yearGroup: 'Y8', context: 'From the file' })]
    )
    expect(brief).toMatchObject({
      title: 'Mine',
      subject: 'Maths',
      yearGroup: 'Y9',
      durationMin: 40,
      ability: 'Set 3',
      targetSlideCount: 6,
      context: 'No calculators\nFrom the file'
    })
  })

  it('uses the first line of the text when no objectives were found', () => {
    const brief = mergeBrief(
      { lessonId: 'l', text: 'Fractions\nmore', documentIds: [], meta: {} },
      [extraction({ objectives: [] })]
    )
    expect(brief.objectives).toEqual(['Fractions'])
  })
})

describe('generationChangeSets', () => {
  const plan: LessonPlan = {
    title: 'Plan title',
    summary: 's',
    slides: ['a', 'b', 'c', 'd'].map((purpose) => ({
      kind: 'content' as const,
      layoutId: 'x',
      purpose,
      keyContent: [],
      objectiveRefs: [0]
    }))
  }
  const brief = { objectives: ['LO'], subject: 'Science' }
  const base = (over: Partial<Parameters<typeof generationChangeSets>[0]> = {}) => ({
    deck: { title: 'Untitled lesson', meta: { objectives: [] }, slides: [] },
    titleSource: 'auto' as const,
    brief,
    plan,
    slideIds: [null, null, null, null],
    made: new Map([0, 1, 2, 3].map((i) => [i, makeSlide(`n${i}`)])),
    newId: sequentialIds(),
    now: steppingClock()().toISOString(),
    ...over
  })

  const deckOf = (ids: string[]): Deck => ({
    ...fixtureDeck(),
    slides: ids.map((id) => makeSlide(id))
  })

  const applyAll = (deck: Deck, sets: ReturnType<typeof generationChangeSets>): string[] => {
    const result = applyChangeSetsGrouped(deck, sets, { id: 'g', summary: 'g' })
    if (!result.ok) throw new Error(result.errors.join(', '))
    return result.deck.slides.map((s) => s.id)
  }

  it('sets the title and meta first, then inserts each slide after the previous one', () => {
    const sets = generationChangeSets(base())
    expect(sets).toHaveLength(5)
    expect(sets[0].ops[0]).toEqual({
      op: 'setMeta',
      title: 'Plan title',
      meta: { objectives: ['LO'], subject: 'Science' }
    })
    expect(sets.slice(1).map((s) => s.ops[0])).toEqual([
      { op: 'insertSlides', afterSlideId: null, slides: [expect.objectContaining({ id: 'n0' })] },
      { op: 'insertSlides', afterSlideId: 'n0', slides: [expect.objectContaining({ id: 'n1' })] },
      { op: 'insertSlides', afterSlideId: 'n1', slides: [expect.objectContaining({ id: 'n2' })] },
      { op: 'insertSlides', afterSlideId: 'n2', slides: [expect.objectContaining({ id: 'n3' })] }
    ])
    expect(sets.every((s) => s.by === 'ai')).toBe(true)
  })

  it('goes after the last slide when the deck already has slides', () => {
    const deck = deckOf(['x', 'y'])
    const ids = applyAll(deck, generationChangeSets(base({ deck })))
    expect(ids).toEqual(['x', 'y', 'n0', 'n1', 'n2', 'n3'])
  })

  it('keeps the title the teacher typed and skips a setMeta with nothing new', () => {
    const typed = generationChangeSets(base({ titleSource: 'user' }))
    expect(typed[0].ops[0]).toEqual({
      op: 'setMeta',
      meta: { objectives: ['LO'], subject: 'Science' }
    })
    const same = generationChangeSets(
      base({
        titleSource: 'user',
        deck: { title: 'x', meta: { objectives: ['LO'], subject: 'Science' }, slides: [] }
      })
    )
    expect(same.every((s) => s.ops[0].op === 'insertSlides')).toBe(true)
  })

  it('finishing puts missing slides at their plan positions between the existing ones', () => {
    const deck = deckOf(['n0', 'u1', 'n3'])
    const sets = generationChangeSets(
      base({
        deck,
        slideIds: ['n0', null, null, 'n3'],
        made: new Map([
          [1, makeSlide('n1')],
          [2, makeSlide('n2')]
        ])
      })
    )
    expect(applyAll(deck, sets)).toEqual(['n0', 'n1', 'n2', 'u1', 'n3'])
  })

  it('finishing before the first existing planned slide inserts at the start', () => {
    const deck = deckOf(['n2', 'n3'])
    const sets = generationChangeSets(
      base({
        deck,
        slideIds: [null, null, 'n2', 'n3'],
        made: new Map([
          [0, makeSlide('n0')],
          [1, makeSlide('n1')]
        ])
      })
    )
    expect(applyAll(deck, sets)).toEqual(['n0', 'n1', 'n2', 'n3'])
  })

  it('ignores slides of an earlier run that were deleted from the deck', () => {
    expect(presentSlideIds(['a'], ['a', 'gone', null])).toEqual(['a', null, null])
  })

  it('metaFrom leaves out what is empty', () => {
    expect(metaFrom({ objectives: ['x'] })).toEqual({ objectives: ['x'] })
    expect(
      metaFrom({
        objectives: ['x'],
        ability: 'Set 2',
        durationMin: 50,
        context: 'c',
        yearGroup: 'Y8'
      })
    ).toEqual({
      objectives: ['x'],
      ability: 'Set 2',
      durationMin: 50,
      context: 'c',
      yearGroup: 'Y8'
    })
  })
})
