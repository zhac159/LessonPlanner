import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { CreateLessonRequest, GenProgress } from '@shared/contracts/deck-builder'
import { makePdf } from '@main/import/testing'
import { tempDir } from '@main/services/lessons/testing'
import { makeApiRig, seedFixtureLesson, type ApiRig } from './testing'

const request = (rig: ApiRig, over: Partial<CreateLessonRequest> = {}): CreateLessonRequest => ({
  objectivesText: '',
  documentIds: [],
  styleId: rig.style.id,
  title: 'Cells',
  meta: { yearGroup: 'Year 7', objectives: [] },
  startGeneration: false,
  blankSlide: true,
  ...over
})

describe('lessons', () => {
  it('starts empty, then lists a blank lesson and announces the change', async () => {
    const rig = await makeApiRig()
    expect(await rig.api.listLessons()).toEqual([])
    const created = await rig.api.createLesson(request(rig))
    expect(created).toMatchObject({ ok: true, jobId: null, messageId: null })
    const list = await rig.api.listLessons()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      title: 'Cells',
      yearShort: 'Year 7',
      slideCount: 1,
      status: 'ready'
    })
    expect(rig.events.some((e) => e.name === 'lessonsChanged')).toBe(true)
  })

  it('"Make my slides" runs a generation job and the slides arrive as events', async () => {
    const rig = await makeApiRig()
    const created = await rig.api.createLesson(
      request(rig, {
        objectivesText: 'Cells\nLO1: Name the parts of a cell',
        startGeneration: true,
        blankSlide: false
      })
    )
    if (!created.ok || !created.jobId) throw new Error('no job')
    await rig.services.generation.whenDone(created.jobId)
    const opened = await rig.api.openLesson({ lessonId: created.lessonId })
    if (!opened.ok) throw new Error(opened.message)
    expect(opened.deck.slides.length).toBeGreaterThan(2)
    const stages = rig.events
      .filter((e) => e.name === 'gen-progress')
      .map((e) => (e.payload as GenProgress).stage)
    expect(stages).toContain('done')
    expect(rig.events.some((e) => e.name === 'slide-ready')).toBe(true)
  })

  it('refuses "Make my slides" without objectives or a document', async () => {
    const rig = await makeApiRig()
    const result = await rig.api.createLesson(request(rig, { startGeneration: true }))
    expect(result).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(await rig.api.listLessons()).toEqual([])
  })

  it('cancel stops a running generation; finishing with nothing stopped is a clear failure', async () => {
    const rig = await makeApiRig({ fake: { delayMs: 40 } })
    const created = await rig.api.createLesson(
      request(rig, {
        objectivesText: 'Cells\nLO1: Parts',
        startGeneration: true,
        blankSlide: false
      })
    )
    if (!created.ok || !created.jobId) throw new Error('no job')
    await rig.api.cancel({ jobId: created.jobId })
    await rig.services.generation.whenDone(created.jobId)
    expect((await rig.api.listLessons())[0].status).toBe('ready')
    const other = await seedFixtureLesson(rig)
    expect(await rig.api.finishGeneration({ lessonId: other })).toMatchObject({
      ok: false,
      code: 'not-found'
    })
  })

  it('renames and duplicates', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    const renamed = await rig.api.renameLesson({ lessonId: id, title: 'Plants and light' })
    expect(renamed).toMatchObject({ ok: true, lesson: { title: 'Plants and light' } })
    const copy = await rig.api.duplicateLesson({ lessonId: id })
    expect(copy.ok && copy.lesson.id).not.toBe(id)
    expect(await rig.api.listLessons()).toHaveLength(2)
    expect(await rig.api.renameLesson({ lessonId: id, title: '   ' })).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
  })

  it('deletes with an undo window: restoreLesson brings it back, with nothing but ok', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    expect(await rig.api.deleteLesson({ lessonId: id })).toEqual({ ok: true })
    expect(await rig.api.listLessons()).toEqual([])
    expect(await rig.api.restoreLesson({ lessonId: id })).toEqual({ ok: true })
    expect((await rig.api.listLessons()).map((l) => l.id)).toEqual([id])
    expect(await rig.api.restoreLesson({ lessonId: 'les_nope' })).toMatchObject({
      ok: false,
      code: 'not-found'
    })
  })

  it('refuses unsafe lesson ids', async () => {
    const rig = await makeApiRig()
    expect(await rig.api.deleteLesson({ lessonId: '../x' })).toMatchObject({ ok: false })
    expect(await rig.api.duplicateLesson({ lessonId: '../x' })).toMatchObject({ ok: false })
  })
})

describe('LO documents', () => {
  it('a cancelled Open dialog is a quiet { cancelled: true }', async () => {
    const rig = await makeApiRig()
    expect(await rig.api.pickLoDocument()).toEqual({ ok: true, cancelled: true })
  })

  it('an imported document is read in the background and reported as documentRead', async () => {
    const rig = await makeApiRig()
    const path = join(tempDir(), 'objectives.pdf')
    await writeFile(path, makePdf(['Learning objectives\nLO1: Describe photosynthesis']))
    const imported = await rig.api.importLoDocument({ path })
    if (!imported.ok) throw new Error(imported.message)
    expect(imported.document).toMatchObject({ name: 'objectives.pdf', kind: 'pdf' })
    await vi.waitFor(() => expect(rig.events.some((e) => e.name === 'documentRead')).toBe(true))
    const read = rig.events.find((e) => e.name === 'documentRead')?.payload as {
      documentId: string
    }
    expect(read.documentId).toBe(imported.document.id)
  })

  it('refuses a file that is not a document', async () => {
    const rig = await makeApiRig()
    const path = join(tempDir(), 'notes.txt')
    await writeFile(path, 'hello')
    expect(await rig.api.importLoDocument({ path })).toMatchObject({ ok: false })
    expect(rig.events.some((e) => e.name === 'documentRead')).toBe(false)
  })
})
