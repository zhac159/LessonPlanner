import { readdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtureDeck } from '@shared/deck/testing'
import { makeRig, seedLesson, writeTemp } from './testing'

describe('create', () => {
  it('writes deck.json, lesson.json and the list entry', async () => {
    const rig = makeRig()
    const created = await rig.service.create({
      styleId: rig.style.id,
      meta: { yearGroup: 'Y8', durationMin: 50 },
      title: null
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const files = readdirSync(join(rig.dir, 'lessons', created.lessonId))
    expect(files).toEqual(expect.arrayContaining(['deck.json', 'lesson.json']))
    expect(created.lesson).toMatchObject({
      title: 'Untitled lesson',
      yearGroup: 'Year 8',
      yearShort: 'Year 8',
      slideCount: 0,
      styleId: rig.style.id,
      status: 'ready'
    })
    expect(rig.changed.length).toBeGreaterThan(0)
  })

  it('treats a typed title as set by hand and a missing one as automatic', async () => {
    const rig = makeRig()
    const typed = await rig.service.create({ styleId: null, meta: {}, title: '  Cells  ' })
    const auto = await rig.service.create({ styleId: null, meta: {}, title: null })
    if (!typed.ok || !auto.ok) throw new Error('create failed')
    const a = await rig.service.open(typed.lessonId)
    const b = await rig.service.open(auto.lessonId)
    expect(a.ok && a.deck.title).toBe('Cells')
    expect(a.ok && a.titleSource).toBe('user')
    expect(b.ok && b.titleSource).toBe('auto')
  })

  it('starts with one empty title slide on the style when asked for a blank slide', async () => {
    const rig = makeRig()
    const created = await rig.service.create({
      styleId: rig.style.id,
      meta: {},
      blankSlide: true
    })
    if (!created.ok) throw new Error('create failed')
    const opened = await rig.service.open(created.lessonId)
    if (!opened.ok) throw new Error('open failed')
    expect(opened.deck.slides).toHaveLength(1)
    expect(opened.deck.slides[0]).toMatchObject({ kind: 'title', layoutId: 'title' })
    expect(opened.deck.styleVersion).toBe(rig.style.version)
  })

  it('rejects an unknown style and an over-long title without creating anything', async () => {
    const rig = makeRig()
    expect(await rig.service.create({ styleId: 'sty_nope', meta: {} })).toMatchObject({
      ok: false,
      code: 'not-found'
    })
    expect(
      await rig.service.create({ styleId: null, meta: {}, title: 'x'.repeat(81) })
    ).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(await rig.service.list()).toEqual([])
  })
})

describe('open', () => {
  it('returns deck, history, sticky notes and the running job', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const started = rig.service.jobs.start(id, 'chat', 'msg_1')
    if (!started.ok) throw new Error('job did not start')
    const opened = await rig.service.open(id)
    expect(opened).toMatchObject({
      ok: true,
      titleSource: 'user',
      history: { canUndo: true, canRedo: false, undoSummary: 'Seed slides' },
      stickyNotes: [],
      runningJob: { jobId: started.job.id, kind: 'chat', messageId: 'msg_1' }
    })
  })

  it('fails with not-found for unknown and unsafe ids', async () => {
    const rig = makeRig()
    expect(await rig.service.open('les_missing')).toMatchObject({ ok: false, code: 'not-found' })
    expect(await rig.service.open('../etc')).toMatchObject({ ok: false, code: 'not-found' })
  })

  it('reports a damaged deck.json as io instead of throwing', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    writeFileSync(join(rig.dir, 'lessons', id, 'deck.json'), '{ not json')
    const fresh = makeRig({ dir: rig.dir })
    expect(await fresh.service.open(id)).toMatchObject({ ok: false, code: 'io' })
  })
})

describe('list and the index cache', () => {
  it('lists newest first with the thumbnail as a data URL', async () => {
    const rig = makeRig()
    const first = await seedLesson(rig, fixtureDeck())
    const second = await rig.service.create({ styleId: null, meta: {}, title: 'Newer' })
    if (!second.ok) throw new Error('create failed')
    await rig.service.flushThumbnails()
    const list = await rig.service.list()
    expect(list.map((l) => l.id)).toEqual([second.lessonId, first])
    expect(list[1].thumbDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(list[0].thumbDataUrl).toBeNull()
  })

  it('rebuilds index.json from the folders when it is missing or corrupt', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    writeFileSync(join(rig.dir, 'index.json'), 'garbage')
    const fresh = makeRig({ dir: rig.dir })
    const list = await fresh.service.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id, slideCount: 3, title: 'Y8 Science — Photosynthesis' })
    const rewritten = JSON.parse(await readFile(join(rig.dir, 'index.json'), 'utf8'))
    expect(rewritten.lessons).toHaveLength(1)
  })

  it('picks up a lesson folder added behind its back', async () => {
    const rig = makeRig()
    await seedLesson(rig, fixtureDeck())
    const other = makeRig({ dir: rig.dir })
    const id = await seedLesson(other, { ...fixtureDeck(), title: 'Second' })
    expect((await rig.service.list()).map((l) => l.id)).toContain(id)
  })

  it('shows a lesson with a damaged deck as a recoverable card that keeps its last known title', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    writeFileSync(join(rig.dir, 'lessons', id, 'deck.json'), '{ nope')
    writeFileSync(join(rig.dir, 'index.json'), 'garbage')
    const fresh = makeRig({ dir: rig.dir })
    const [card] = await fresh.service.list()
    expect(card).toMatchObject({ id, damaged: true, thumbDataUrl: null, status: 'ready' })
    expect(card.title).toBe('Lesson that can’t be opened')
  })

  it('flags a lesson as damaged when opening it fails, keeping its last known title', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    writeFileSync(join(rig.dir, 'lessons', id, 'deck.json'), '{ nope')
    const fresh = makeRig({ dir: rig.dir })
    expect((await fresh.service.list())[0].damaged).toBeUndefined()
    expect(await fresh.service.open(id)).toMatchObject({ ok: false, code: 'io' })
    const [card] = await fresh.service.list()
    expect(card).toMatchObject({ damaged: true, title: 'Y8 Science — Photosynthesis' })
    expect(fresh.changed.at(-1)?.[0]).toMatchObject({ id })
  })

  it('marks a lesson with a running generation as generating', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const started = rig.service.jobs.start(id, 'generation', 'msg_9')
    expect(started.ok).toBe(true)
    expect((await rig.service.list())[0].status).toBe('generating')
  })
})

describe('rename', () => {
  it('is a setMeta ChangeSet, one undo step, and marks the title as set by hand', async () => {
    const rig = makeRig()
    const created = await rig.service.create({ styleId: null, meta: {} })
    if (!created.ok) throw new Error('create failed')
    const renamed = await rig.service.rename(created.lessonId, '  Photosynthesis  ')
    expect(renamed).toMatchObject({ ok: true, lesson: { title: 'Photosynthesis' } })
    const opened = await rig.service.open(created.lessonId)
    expect(opened).toMatchObject({
      ok: true,
      titleSource: 'user',
      history: { canUndo: true, undoSummary: 'Renamed the lesson to “Photosynthesis”' }
    })
    const undone = await rig.service.undo(created.lessonId)
    expect(undone.ok && undone.deck.title).toBe('Untitled lesson')
  })

  it('refuses an empty or over-long title', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    expect(await rig.service.rename(id, '   ')).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(await rig.service.rename(id, 'y'.repeat(81))).toMatchObject({ ok: false })
  })
})

describe('duplicate', () => {
  it('copies slides, pictures and notes but starts with a fresh history and chat', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const attached = await rig.service.files.attach(id, await writeTemp('pic.png'))
    expect(attached.ok).toBe(true)
    writeFileSync(join(rig.dir, 'lessons', id, 'chat.jsonl'), '{"id":"m"}\n')
    const copy = await rig.service.duplicate(id)
    if (!copy.ok) throw new Error(copy.message)
    expect(copy.lesson.id).not.toBe(id)
    expect(copy.lesson.title).toBe('Y8 Science — Photosynthesis (copy)')
    expect(copy.lesson.slideCount).toBe(3)
    const files = readdirSync(join(rig.dir, 'lessons', copy.lesson.id))
    expect(files).toContain('assets')
    expect(files).not.toContain('changes.jsonl')
    expect(files).not.toContain('chat.jsonl')
    const opened = await rig.service.open(copy.lesson.id)
    expect(opened).toMatchObject({ ok: true, history: { canUndo: false }, titleSource: 'user' })
    expect(opened.ok && opened.deck.id).toBe(copy.lesson.id)
  })

  it('fails for a lesson that does not exist', async () => {
    const rig = makeRig()
    expect(await rig.service.duplicate('les_nope')).toMatchObject({ ok: false, code: 'not-found' })
  })
})

describe('delete with an undo window', () => {
  it('removes the lesson from the list at once and can bring it back', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    expect(await rig.service.delete(id)).toEqual({ ok: true })
    expect(await rig.service.list()).toEqual([])
    expect(await rig.service.open(id)).toMatchObject({ ok: false, code: 'not-found' })
    const back = await rig.service.undoDelete(id)
    expect(back).toMatchObject({ ok: true, lesson: { id, slideCount: 3 } })
    expect(await rig.service.list()).toHaveLength(1)
    expect((await rig.service.open(id)).ok).toBe(true)
  })

  it('sends the folder to the Recycle Bin when the window ends', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    await rig.service.delete(id)
    await rig.service.finalizeDeletes()
    expect(rig.trash.trashed).toEqual([join(rig.dir, 'deleted', id)])
    expect(await rig.service.undoDelete(id)).toMatchObject({ ok: false, code: 'not-found' })
  })

  it('finalises a lesson left in deleted/ by an earlier run', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    await rig.service.delete(id)
    const next = makeRig({ dir: rig.dir })
    await next.service.finalizeDeletes()
    expect(next.trash.trashed).toEqual([join(rig.dir, 'deleted', id)])
  })

  it('removes the folder for good when there is no Recycle Bin', async () => {
    const rig = makeRig({ trash: undefined })
    const id = await seedLesson(rig, fixtureDeck())
    await rig.service.delete(id)
    await rig.service.finalizeDeletes()
    expect(readdirSync(join(rig.dir, 'deleted'))).toEqual([])
  })

  it('refuses while an AI job is running and for unknown lessons', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    rig.service.jobs.start(id, 'chat', 'msg_1')
    expect(await rig.service.delete(id)).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(await rig.service.delete('les_nope')).toMatchObject({ ok: false, code: 'not-found' })
  })

  it('still deletes a lesson whose deck is damaged', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    writeFileSync(join(rig.dir, 'lessons', id, 'deck.json'), '{ nope')
    expect(await rig.service.delete(id)).toEqual({ ok: true })
    expect(await rig.service.list()).toEqual([])
  })
})

describe('sticky notes', () => {
  it('are stored with the lesson and dropped when their slide is gone', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const note = { id: 'n1', slideId: 's1', x: 10, y: 20, text: 'Ask about gloves' }
    const stray = { id: 'n2', slideId: 'nope', x: 0, y: 0, text: 'stray' }
    expect(await rig.service.setStickyNotes(id, [note, stray])).toEqual({ ok: true })
    const fresh = makeRig({ dir: rig.dir })
    const opened = await fresh.service.open(id)
    expect(opened.ok && opened.stickyNotes).toEqual([note])
  })

  it('fail for an unknown lesson', async () => {
    const rig = makeRig()
    expect(await rig.service.setStickyNotes('les_nope', [])).toMatchObject({ ok: false })
  })
})
