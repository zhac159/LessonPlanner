/** The pure parts of the chat service: labels, captions, errors, records, items, the store. */
import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fail } from '@shared/result'
import { makeChangeSet, makeSlide } from '@shared/deck/testing'
import type { ChangeSet } from '@shared/deck/types'
import { tempDir } from '../lessons/testing'
import { describeChanges } from './changeLabel'
import { errorAction, errorOf, toAiErrorCode } from './errors'
import { changeSetIdsOf, toChatItem } from './items'
import { captionOf, describeRegions } from './regions'
import { parseChatRecord, type ChatRecord } from './records'
import { ChatStore } from './store'

const ids = ['s1', 's2', 's3']
const set = (...ops: ChangeSet['ops']): ChangeSet => makeChangeSet(ops, { summary: 'Summary' })

describe('describeChanges', () => {
  it('labels added slides', () => {
    const added = set({
      op: 'insertSlides',
      afterSlideId: null,
      slides: [makeSlide('a'), makeSlide('b')]
    })
    expect(describeChanges([added], ids)).toEqual({ label: '2 slides added', slideIds: ['a', 'b'] })
    const one = set({ op: 'insertSlides', afterSlideId: null, slides: [makeSlide('a')] })
    expect(describeChanges([one], ids).label).toBe('1 slide added')
  })

  it('counts quiz and answer slides as quiz slides, but only when all added slides are', () => {
    const quiz = set({
      op: 'insertSlides',
      afterSlideId: 's3',
      slides: [makeSlide('q1', { kind: 'quiz' }), makeSlide('a1', { kind: 'answers' })]
    })
    expect(describeChanges([quiz], ids).label).toBe('2 quiz slides added')
    const mixed = set({
      op: 'insertSlides',
      afterSlideId: 's3',
      slides: [makeSlide('q1', { kind: 'quiz' }), makeSlide('c1')]
    })
    expect(describeChanges([mixed], ids).label).toBe('2 slides added')
  })

  it('labels removals and does not point at removed slides', () => {
    expect(describeChanges([set({ op: 'deleteSlides', slideIds: ['s1', 's2'] })], ids)).toEqual({
      label: '2 slides removed',
      slideIds: []
    })
    expect(describeChanges([set({ op: 'deleteSlides', slideIds: ['s1'] })], ids).label).toBe(
      '1 slide removed'
    )
  })

  it('names the slide when one slide changed and counts when several did', () => {
    const one = set({ op: 'updateSlide', slideId: 's2', set: { notes: 'x' } })
    expect(describeChanges([one], ids)).toEqual({ label: 'Slide 2 changed', slideIds: ['s2'] })
    const element = set(
      { op: 'removeElement', slideId: 's3', elementId: 'e' },
      { op: 'removeElement', slideId: 's3', elementId: 'f' }
    )
    expect(describeChanges([element], ids).label).toBe('Slide 3 changed')
    const many = set(
      { op: 'updateSlide', slideId: 's1', set: { notes: 'x' } },
      { op: 'replaceSlide', slide: makeSlide('s3') }
    )
    expect(describeChanges([many], ids)).toEqual({
      label: '2 slides changed',
      slideIds: ['s1', 's3']
    })
    expect(describeChanges([set({ op: 'updateSlide', slideId: 'gone', set: {} })], ids).label).toBe(
      '1 slide changed'
    )
  })

  it('merges several ChangeSets of one message', () => {
    const a = set({ op: 'insertSlides', afterSlideId: null, slides: [makeSlide('n')] })
    const b = set({ op: 'updateSlide', slideId: 's1', set: { notes: 'x' } })
    expect(describeChanges([a, b], ids)).toEqual({
      label: '2 slides changed',
      slideIds: ['n', 's1']
    })
  })

  it('falls back to the summary for changes without slide operations', () => {
    expect(describeChanges([set({ op: 'setMeta', title: 'New' })], ids).label).toBe('Summary')
  })
})

describe('captionOf', () => {
  it('keeps short text and cuts long text at a word boundary', () => {
    expect(captionOf('Make it bigger')).toBe('Make it bigger')
    expect(captionOf('Swap this photo for a labelled diagram of a leaf')).toBe(
      'Swap this photo for a…'
    )
    expect(captionOf('Supercalifragilisticexpialidocious and more')).toBe(
      'Supercalifragilisticexpi…'
    )
    expect(captionOf('  a \n b  ')).toBe('a b')
  })
})

describe('describeRegions', () => {
  it('sorts by number and drops regions on missing slides', () => {
    const deck = { slides: [makeSlide('s1'), makeSlide('s2')] }
    const draft = (n: number, slideId: string) => ({
      id: `r${n}`,
      n,
      slideId,
      path: [[0, 0]] as Array<[number, number]>,
      bbox: { x: 0, y: 0, w: 1, h: 1 },
      targetElementIds: []
    })
    const stored = describeRegions(
      [draft(2, 's2'), draft(1, 'gone'), draft(3, 's1')],
      deck,
      'Fix it'
    )
    expect(stored.map((r) => [r.n, r.slideId, r.slideNumber, r.caption])).toEqual([
      [2, 's2', 2, 'Fix it'],
      [3, 's1', 1, 'Fix it']
    ])
  })
})

describe('errors', () => {
  it('maps codes to the single action button', () => {
    expect(errorAction('no-key', 'chat')).toBe('settings')
    expect(errorAction('permission', 'chat')).toBe('settings')
    expect(errorAction('no-credit', 'chat')).toBe('console')
    expect(errorAction('network', 'chat')).toBe('retry')
    expect(errorAction('invalid-input', 'plugin')).toBe('retry')
    expect(errorAction('refused', 'chat')).toBeUndefined()
    expect(errorAction('cancelled', 'chat')).toBeUndefined()
    expect(errorAction('cancelled', 'generation')).toBe('finish')
    expect(errorAction('network', 'generation')).toBe('finish')
  })

  it('maps codes to AI error codes for events', () => {
    expect(toAiErrorCode('rate-limited')).toBe('rate-limited')
    expect(toAiErrorCode('invalid-input')).toBe('unknown')
    expect(toAiErrorCode('io')).toBe('unknown')
    expect(toAiErrorCode('cancelled')).toBe('unknown')
  })

  it('errorOf carries code, message and action', () => {
    expect(errorOf(fail('no-key', 'Not connected'), 'chat')).toEqual({
      code: 'no-key',
      message: 'Not connected',
      action: 'settings'
    })
    expect(errorOf(fail('refused', 'No'), 'chat')).toEqual({ code: 'refused', message: 'No' })
  })
})

const record = (
  over: Omit<Partial<ChatRecord>, 'ui'> & { ui?: Partial<ChatRecord['ui']> } = {}
): ChatRecord => ({
  id: 'm1',
  role: 'assistant',
  at: '2026-10-06T09:00:00.000Z',
  api: [],
  ...over,
  ui: { text: 'Done', ...over.ui }
})

describe('records', () => {
  it('parses valid records and rejects broken ones', () => {
    expect(parseChatRecord(record())).toMatchObject({ id: 'm1' })
    expect(parseChatRecord({ id: 'x' })).toBeUndefined()
    expect(parseChatRecord(record({ role: 'robot' as 'user' }))).toBeUndefined()
    expect(parseChatRecord({ ...record(), api: 'nope' })).toBeUndefined()
  })
})

describe('toChatItem', () => {
  it('keeps text, attachments, regions, file, error and plugin id', () => {
    const attachments = [{ id: 'a', name: 'x.docx', kind: 'docx' as const, sizeBytes: 3 }]
    const item = toChatItem(
      record({
        ui: {
          attachments,
          pluginId: 'quiz',
          file: { name: 'Quiz.docx', path: 'C:/q.docx', kind: 'docx' },
          error: { code: 'network', message: 'x', action: 'retry' }
        }
      }),
      new Map(),
      ids
    )
    expect(item).toMatchObject({
      id: 'm1',
      role: 'assistant',
      text: 'Done',
      attachments,
      pluginId: 'quiz'
    })
    expect(item.file?.name).toBe('Quiz.docx')
    expect(item.error?.action).toBe('retry')
    expect(item.result).toBeUndefined()
  })

  it('points the chip at the last change and reports Undone from that change', () => {
    const a = set({ op: 'updateSlide', slideId: 's1', set: { notes: 'x' } })
    const b = set({ op: 'updateSlide', slideId: 's2', set: { notes: 'y' } })
    const changes = new Map([
      [a.id, { changeSet: a, undone: false }],
      [b.id, { changeSet: b, undone: true }]
    ])
    const item = toChatItem(
      record({ ui: { changeSetIds: [a.id, b.id, 'chg_gone'] } }),
      changes,
      ids
    )
    expect(item.result).toEqual({
      changeSetId: b.id,
      label: '2 slides changed',
      slideIds: ['s1', 's2'],
      undone: true
    })
  })

  it('gives no chip when the change has left the history', () => {
    expect(
      toChatItem(record({ ui: { changeSetIds: ['chg_gone'] } }), new Map(), ids).result
    ).toBeUndefined()
  })

  it('changeSetIdsOf lists each id once', () => {
    expect(
      changeSetIdsOf([
        record({ ui: { changeSetIds: ['a', 'b'] } }),
        record({ ui: { changeSetIds: ['b'] } })
      ])
    ).toEqual(['a', 'b'])
  })
})

describe('ChatStore', () => {
  const store = () => {
    const dir = tempDir()
    return { dir, store: new ChatStore((id) => join(dir, `${id}.jsonl`)) }
  }

  it('appends records and reads them back in order, with their API messages', async () => {
    const { store: s } = store()
    expect(await s.read('l1')).toEqual([])
    await s.append('l1', record({ id: 'a', api: [{ role: 'user', content: [] }] }))
    await s.append('l1', record({ id: 'b', api: [{ role: 'assistant', content: [] }] }))
    expect((await s.read('l1')).map((r) => r.id)).toEqual(['a', 'b'])
    expect(await s.apiHistory('l1')).toEqual([
      { role: 'user', content: [] },
      { role: 'assistant', content: [] }
    ])
  })

  it('skips damaged and invalid lines', async () => {
    const { dir, store: s } = store()
    await s.append('l1', record({ id: 'a' }))
    appendFileSync(join(dir, 'l1.jsonl'), '{"half\n{"id":1}\n\n')
    await s.append('l1', record({ id: 'b' }))
    expect((await s.read('l1')).map((r) => r.id)).toEqual(['a', 'b'])
    writeFileSync(join(dir, 'l2.jsonl'), 'garbage')
    expect(await s.read('l2')).toEqual([])
  })
})
