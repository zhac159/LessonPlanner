/** Small building blocks of the lessons services: mutex, jobs, history mirror, summary helpers, files, blank decks. */
import { describe, expect, it } from 'vitest'
import { applyChangeSet } from '@shared/deck/apply'
import { changeLine, UNDO_LINE } from '@shared/deck/history'
import { fixtureDeck, fixtureStyle, makeChangeSet, makeSlide } from '@shared/deck/testing'
import { blankSlide, cleanTitle, newDeck } from './blank'
import { documentKindOf, numberedName, safeFileName } from './files'
import { LessonHistory } from './history'
import { JobRegistry, LESSON_BUSY } from './jobs'
import { KeyedMutex } from './mutex'
import { yearLabels } from './summary'
import { sequentialIds, steppingClock } from './testing'

describe('KeyedMutex', () => {
  it('runs tasks of one key in order and different keys independently', async () => {
    const mutex = new KeyedMutex()
    const log: string[] = []
    const slow = mutex.run('a', async () => {
      await new Promise((r) => setTimeout(r, 20))
      log.push('a1')
    })
    const second = mutex.run('a', async () => void log.push('a2'))
    const other = mutex.run('b', async () => void log.push('b1'))
    await Promise.all([slow, second, other])
    expect(log).toEqual(['b1', 'a1', 'a2'])
  })

  it('keeps going after a task fails and still rejects that caller', async () => {
    const mutex = new KeyedMutex()
    const failing = mutex.run('a', async () => Promise.reject(new Error('boom')))
    const next = mutex.run('a', async () => 'fine')
    await expect(failing).rejects.toThrow('boom')
    await expect(next).resolves.toBe('fine')
  })
})

describe('JobRegistry', () => {
  it('allows one job per lesson and frees the lesson when the work settles', async () => {
    const jobs = new JobRegistry(sequentialIds())
    const first = jobs.start('les_1', 'chat', 'msg_1')
    if (!first.ok) throw new Error('should start')
    expect(jobs.start('les_1', 'plugin', 'msg_2')).toMatchObject({
      ok: false,
      message: LESSON_BUSY
    })
    expect(jobs.start('les_2', 'chat', 'msg_3').ok).toBe(true)
    expect(jobs.running('les_1')).toBe(first.job)
    await jobs.attach(first.job, async () => undefined)
    expect(jobs.running('les_1')).toBeUndefined()
    expect(jobs.start('les_1', 'chat', 'msg_4').ok).toBe(true)
  })

  it('cancel aborts the signal; the job still finishes through attach, even when the work throws', async () => {
    const jobs = new JobRegistry(sequentialIds())
    const started = jobs.start('les_1', 'generation', 'msg_1')
    if (!started.ok) throw new Error('should start')
    const { job } = started
    const done = jobs.attach(job, async () => {
      await new Promise((r) => job.signal.addEventListener('abort', r))
      throw new Error('stopped')
    })
    expect(jobs.get(job.id)).toBe(job)
    expect(jobs.cancel(job.id)).toBe(true)
    await done
    expect(job.signal.aborted).toBe(true)
    expect(jobs.get(job.id)).toBeUndefined()
    expect(jobs.cancel(job.id)).toBe(false)
    expect(jobs.cancel('job_unknown')).toBe(false)
  })
})

describe('LessonHistory', () => {
  const rename = (title: string) =>
    makeChangeSet([{ op: 'setMeta', title }], { summary: `to ${title}` })

  function journal(): { lines: string[]; history: LessonHistory } {
    let deck = fixtureDeck()
    const lines: string[] = []
    for (const title of ['A', 'B', 'C']) {
      const applied = applyChangeSet(deck, rename(title))
      if (!applied.ok) throw new Error('apply failed')
      deck = applied.deck
      lines.push(
        changeLine({
          changeSet: applied.changeSet,
          patches: applied.patches,
          inversePatches: applied.inversePatches
        })
      )
    }
    return { lines, history: LessonHistory.fromJournal(lines) }
  }

  it('knows the change on top of each stack after replaying a journal', () => {
    const { lines } = journal()
    const replayed = LessonHistory.fromJournal([...lines, UNDO_LINE, UNDO_LINE])
    expect(replayed.state()).toMatchObject({
      canUndo: true,
      canRedo: true,
      undoSummary: 'to A',
      redoSummary: 'to B'
    })
    expect(replayed.find(replayed.nextRedo!.id)).toMatchObject({ undone: true })
  })

  it('ignores damaged lines like DeckHistory does', () => {
    const { lines } = journal()
    const history = LessonHistory.fromJournal(['not json', lines[0], '{"v":1,"kind":"change"}', ''])
    expect(history.state().undoSummary).toBe('to A')
    expect(history.nextRedo).toBeUndefined()
  })

  it('records, undoes and redoes with matching state, and clears redo on a new change', () => {
    const history = LessonHistory.fromJournal([])
    expect(history.state()).toEqual({
      canUndo: false,
      canRedo: false,
      undoChangeSetId: null,
      redoChangeSetId: null
    })
    let deck = fixtureDeck()
    const apply = (title: string) => {
      const applied = applyChangeSet(deck, rename(title))
      if (!applied.ok) throw new Error('apply failed')
      deck = applied.deck
      history.record({
        changeSet: applied.changeSet,
        patches: applied.patches,
        inversePatches: applied.inversePatches
      })
    }
    apply('A')
    apply('B')
    const undone = history.undo(deck)
    if (!undone.ok) throw new Error('undo failed')
    deck = undone.deck
    expect(history.state().redoSummary).toBe('to B')
    const redone = history.redo(deck)
    expect(redone.ok && redone.deck.title).toBe('B')
    history.undo(redone.ok ? redone.deck : deck)
    apply('C')
    expect(history.state()).toMatchObject({ canRedo: false, undoSummary: 'to C' })
    expect(history.find('chg_unknown')).toBeUndefined()
  })

  it('stops at 200 undo steps', () => {
    const history = LessonHistory.fromJournal([])
    let deck = fixtureDeck()
    for (let i = 0; i < 205; i++) {
      const applied = applyChangeSet(deck, rename(`T${i}`))
      if (!applied.ok) throw new Error('apply failed')
      deck = applied.deck
      history.record({
        changeSet: applied.changeSet,
        patches: applied.patches,
        inversePatches: applied.inversePatches
      })
    }
    let steps = 0
    while (history.state().canUndo) {
      const undone = history.undo(deck)
      if (!undone.ok) break
      deck = undone.deck
      steps++
    }
    expect(steps).toBe(200)
  })
})

describe('yearLabels', () => {
  it.each([
    ['Y8', 'Year 8', 'Year 8'],
    ['year 10', 'Year 10', 'Year 10'],
    ['Yr 7', 'Year 7', 'Year 7'],
    ['Form time', 'Form time', 'Form'],
    ['Sixth form', 'Sixth form', 'Sixth']
  ])('%s', (input, yearGroup, yearShort) => {
    expect(yearLabels(input)).toEqual({ yearGroup, yearShort })
  })

  it('is empty without a year', () => {
    expect(yearLabels(undefined)).toEqual({ yearGroup: null, yearShort: null })
    expect(yearLabels('   ')).toEqual({ yearGroup: null, yearShort: null })
  })
})

describe('file names', () => {
  it('removes what Windows forbids, trims and keeps the extension', () => {
    expect(safeFileName('Quiz: cells?.docx')).toBe('Quiz cells.docx')
    expect(safeFileName('  a   b .docx')).toBe('a b.docx')
    expect(safeFileName('???.docx')).toBe('File.docx')
    expect(safeFileName('CON.docx')).toBe('CON file.docx')
    expect(safeFileName('x'.repeat(300) + '.pdf')).toHaveLength(124)
  })

  it('numbers repeated names', () => {
    expect(numberedName('Quiz.docx', 2)).toBe('Quiz (2).docx')
    expect(numberedName('Quiz', 3)).toBe('Quiz (3)')
  })

  it('recognises document kinds by extension, case-insensitively', () => {
    expect(documentKindOf('A.DOCX')).toBe('docx')
    expect(documentKindOf('a.pdf')).toBe('pdf')
    expect(documentKindOf('a.pptx')).toBe('pptx')
    expect(documentKindOf('a.png')).toBeUndefined()
  })
})

describe('blank decks', () => {
  it('newDeck starts empty with the style version and the given meta', () => {
    const deck = newDeck({
      id: 'les_1',
      title: 'T',
      meta: { yearGroup: 'Y8' },
      style: fixtureStyle(),
      now: steppingClock()()
    })
    expect(deck).toMatchObject({
      id: 'les_1',
      slides: [],
      styleId: 'sty_science_ks3',
      styleVersion: 3,
      meta: { yearGroup: 'Y8', objectives: [] },
      createdAt: deck.updatedAt
    })
  })

  it('blankSlide uses the title layout and has an empty title', () => {
    const slide = blankSlide('s1', fixtureStyle())
    expect(slide).toMatchObject({ id: 's1', kind: 'title', layoutId: 'title' })
    expect(slide.elements.some((e) => e.type === 'text' && e.role === 'title')).toBe(true)
    expect(blankSlide('s2', null).layoutId).toBeUndefined()
    expect(makeSlide('x').elements).toEqual([])
  })

  it('cleanTitle collapses spaces and enforces 1..80 characters', () => {
    expect(cleanTitle('  Cells   and  tissues ')).toBe('Cells and tissues')
    expect(cleanTitle('   ')).toBeNull()
    expect(cleanTitle('a'.repeat(80))).toHaveLength(80)
    expect(cleanTitle('a'.repeat(81))).toBeNull()
  })
})
