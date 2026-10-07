import { describe, expect, it } from 'vitest'
import { createFakeAiService } from '../../ai/fake'
import { FakeDialogs, FakeRenderer, FakeTrash, tempDir } from '../lessons/testing'
import { getCurrentDeckBuilder, setCurrentDeckBuilder } from './current'
import { createDeckBuilderServices } from './services'
import { fakeStyleLookup } from './testing'

async function build(delayMs = 0) {
  const trash = new FakeTrash()
  const services = await createDeckBuilderServices({
    dir: tempDir(),
    ai: createFakeAiService({ delayMs }),
    styles: fakeStyleLookup(),
    dialogs: new FakeDialogs(),
    renderer: new FakeRenderer(),
    trash,
    emit: () => undefined,
    undoWindowMs: 60_000
  })
  return { services, trash }
}

describe('createDeckBuilderServices', () => {
  it('shares one job registry across generation, chat and plugins, and loads the plugins', async () => {
    const { services } = await build()
    expect(services.plugins.list().map((p) => p.id)).toEqual(
      expect.arrayContaining(['quiz', 'speaker-notes'])
    )
    const created = await services.lessons.create({ styleId: null, meta: {}, blankSlide: true })
    if (!created.ok) throw new Error(created.message)
    const started = await services.chat.send({
      lessonId: created.lessonId,
      text: 'Hello',
      attachmentIds: [],
      regions: [],
      markup: [],
      selectedSlideId: '',
      assetRefs: []
    })
    if (!started.ok) throw new Error(started.message)
    // a second kind of job on the same lesson is refused while the chat turn runs
    expect(
      await services.generation.generate({
        lessonId: created.lessonId,
        text: 'LO1: x',
        documentIds: [],
        meta: {}
      })
    ).toMatchObject({ ok: false })
    await services.chat.whenDone(started.jobId)
  })

  it('dispose stops running jobs, moves pending deletes to the Recycle Bin and is repeatable', async () => {
    const { services, trash } = await build(200)
    const doomed = await services.lessons.create({ styleId: null, meta: {}, blankSlide: true })
    const busy = await services.lessons.create({ styleId: null, meta: {}, blankSlide: true })
    if (!doomed.ok || !busy.ok) throw new Error('create failed')
    await services.lessons.delete(doomed.lessonId)
    const started = await services.generation.generate({
      lessonId: busy.lessonId,
      text: 'LO1: something',
      documentIds: [],
      meta: {}
    })
    if (!started.ok) throw new Error(started.message)

    await services.dispose()
    await services.dispose()
    expect(services.lessons.jobs.running(busy.lessonId)).toBeUndefined()
    expect(trash.trashed).toHaveLength(1)
    expect(trash.trashed[0]).toContain(doomed.lessonId)
  })
})

describe('the current deck-builder holder', () => {
  it('holds what the module published and clears with null', async () => {
    const { services } = await build()
    expect(getCurrentDeckBuilder()).toBeNull()
    setCurrentDeckBuilder({ services, emit: () => undefined })
    expect(getCurrentDeckBuilder()?.services).toBe(services)
    setCurrentDeckBuilder(null)
    expect(getCurrentDeckBuilder()).toBeNull()
  })
})
