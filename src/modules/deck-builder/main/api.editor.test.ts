import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { LessonView } from '@shared/contracts/deck-builder'
import { tempDir } from '@main/services/lessons/testing'
import { makeApiRig, seedFixtureLesson, type ApiRig } from './testing'

async function openView(rig: ApiRig, lessonId: string): Promise<LessonView> {
  const opened = await rig.api.openLesson({ lessonId })
  if (!opened.ok) throw new Error(opened.message)
  return opened
}

describe('opening a lesson', () => {
  it('returns the deck with its style, an empty chat, history state and no running job', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    const view = await openView(rig, id)
    expect(view.deck.slides).toHaveLength(3)
    expect(view.style).toMatchObject({ name: 'Science KS3' })
    expect(view.chat).toEqual([])
    expect(view.history.canRedo).toBe(false)
    expect(view.runningJob).toBeNull()
    expect(view.stickyNotes).toEqual([])
    expect(view.titleSource).toBe('user')
  })

  it('has no style view for the plain style and fails clearly for an unknown lesson', async () => {
    const rig = await makeApiRig()
    const created = await rig.services.lessons.create({ styleId: null, meta: {}, blankSlide: true })
    if (!created.ok) throw new Error(created.message)
    expect((await openView(rig, created.lessonId)).style).toBeNull()
    expect(await rig.api.openLesson({ lessonId: 'les_missing' })).toMatchObject({
      ok: false,
      code: 'not-found'
    })
  })
})

describe('direct edits', () => {
  it('applyOps is one undo step; undo and redo return the deck and the buttons state', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    const before = (await openView(rig, id)).deck.title
    const applied = await rig.api.applyOps({
      lessonId: id,
      ops: [{ op: 'setMeta', title: 'Plants and light' }],
      summary: 'Renamed'
    })
    if (!applied.ok) throw new Error(applied.message)
    expect(applied.changeSet.by).toBe('user')
    expect(applied.history).toMatchObject({ canUndo: true, canRedo: false })

    const undone = await rig.api.undo({ lessonId: id })
    if (!undone.ok) throw new Error(undone.message)
    expect(undone.deck.title).toBe(before)
    expect(undone.history).toMatchObject({ canUndo: true, canRedo: true })

    const redone = await rig.api.redo({ lessonId: id })
    if (!redone.ok) throw new Error(redone.message)
    expect(redone.deck.title).toBe('Plants and light')
    expect(redone.history.canRedo).toBe(false)
  })

  it('rejects ops for slides that do not exist and leaves the deck alone', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    const result = await rig.api.applyOps({
      lessonId: id,
      ops: [{ op: 'deleteSlides', slideIds: ['nope'] }],
      summary: 'Bad'
    })
    expect(result.ok).toBe(false)
    expect((await openView(rig, id)).deck.slides).toHaveLength(3)
  })

  it('undo with nothing to undo is a failure, not a throw', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    await rig.api.undo({ lessonId: id })
    expect((await rig.api.undo({ lessonId: id })).ok).toBe(false)
  })

  it('keeps sticky notes for slides that exist and drops the rest', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    const slideId = (await openView(rig, id)).deck.slides[0].id
    const notes = [
      { id: 'n1', slideId, x: 10, y: 20, text: 'Ask Sam' },
      { id: 'n2', slideId: 'gone', x: 0, y: 0, text: 'Orphan' }
    ]
    expect(await rig.api.setStickyNotes({ lessonId: id, notes })).toEqual({ ok: true })
    expect((await openView(rig, id)).stickyNotes).toEqual([notes[0]])
  })
})

describe('export, open and show', () => {
  it('exports to the chosen path, then opens and reveals only that file', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    const target = join(tempDir(), 'Photosynthesis.pptx')
    rig.dialogs.savePath = target
    const result = await rig.api.exportPptx({ lessonId: id, ignoreSpots: true })
    expect(result).toMatchObject({ status: 'saved', path: target, fileName: 'Photosynthesis.pptx' })
    expect(existsSync(target)).toBe(true)

    expect(await rig.api.openExport({ path: target })).toEqual({ ok: true })
    expect(await rig.api.showExport({ path: target })).toEqual({ ok: true })
    expect(rig.opener.opened).toEqual([target])
    expect(rig.opener.shown).toEqual([target])
  })

  it('is cancelled when the Save dialog is dismissed', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    expect(await rig.api.exportPptx({ lessonId: id, ignoreSpots: true })).toEqual({
      status: 'cancelled'
    })
  })

  it('refuses to open a file main did not make', async () => {
    const rig = await makeApiRig()
    const other = join(tempDir(), 'virus.exe')
    expect(await rig.api.openExport({ path: other })).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
    expect(await rig.api.showExport({ path: other })).toMatchObject({ ok: false })
    expect(rig.opener.opened).toEqual([])
    expect(rig.opener.shown).toEqual([])
  })

  it('opens a file a plugin saved in the lesson outputs folder', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    const folder = join(rig.dir, 'lessons', id, 'outputs')
    await mkdir(folder, { recursive: true })
    const file = join(folder, 'Quiz.docx')
    await writeFile(file, 'x')
    expect(await rig.api.openExport({ path: file })).toEqual({ ok: true })
    expect(rig.opener.opened).toEqual([file])
  })

  it('reports the reason when Windows cannot open the file', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    const target = join(tempDir(), 'Lesson.pptx')
    rig.dialogs.savePath = target
    await rig.api.exportPptx({ lessonId: id, ignoreSpots: true })
    rig.opener.answer = 'No application is associated'
    expect(await rig.api.openExport({ path: target })).toMatchObject({
      ok: false,
      code: 'io',
      message: expect.stringContaining('No application is associated')
    })
  })
})

describe('present', () => {
  it('switches the window to full screen and back', async () => {
    const rig = await makeApiRig()
    await rig.api.present({ on: true })
    await rig.api.present({ on: false })
    expect(rig.fullScreen.calls).toEqual([true, false])
  })
})
