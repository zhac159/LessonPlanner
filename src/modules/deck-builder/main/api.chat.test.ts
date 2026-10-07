import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makePdf } from '@main/import/testing'
import { tempDir } from '@main/services/lessons/testing'
import { makeApiRig, seedFixtureLesson } from './testing'

const send = (lessonId: string, text: string) => ({
  lessonId,
  text,
  attachmentIds: [],
  regions: [],
  markup: [],
  selectedSlideId: '',
  assetRefs: []
})

describe('chat', () => {
  it('a turn runs as a job, edits the deck, ends with chat:done and shows in the history', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    const started = await rig.api['chat:send'](send(id, 'Delete slide 3'))
    if (!started.ok) throw new Error(started.message)
    await rig.services.chat.whenDone(started.jobId)

    const names = rig.events.map((e) => e.name)
    expect(names).toContain('chat:changes')
    expect(names).toContain('chat:done')
    const opened = await rig.api.openLesson({ lessonId: id })
    if (!opened.ok) throw new Error(opened.message)
    expect(opened.deck.slides).toHaveLength(2)
    expect(opened.chat.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(opened.chat[1].result).toMatchObject({ undone: false })
  })

  it('refuses an empty message and an unknown lesson', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    expect(await rig.api['chat:send'](send(id, '   '))).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
    expect(await rig.api['chat:send'](send('les_missing', 'Hello'))).toMatchObject({ ok: false })
  })

  it('cancel on an unknown job does nothing and does not throw', async () => {
    const rig = await makeApiRig()
    expect(() => rig.api['chat:cancel']({ jobId: 'job_none' })).not.toThrow()
    expect(() => rig.api.cancel({ jobId: 'job_none' })).not.toThrow()
    expect(() => rig.api['plugins:cancel']({ jobId: 'job_none' })).not.toThrow()
  })

  it('attaches a dropped file, and a dismissed Open dialog is { cancelled: true }', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    expect(await rig.api['chat:attach']({ lessonId: id })).toEqual({ ok: true, cancelled: true })
    const path = join(tempDir(), 'worksheet.pdf')
    await writeFile(path, makePdf(['Worksheet']))
    const attached = await rig.api['chat:attachPath']({ lessonId: id, path })
    expect(attached).toMatchObject({ ok: true, attachment: { name: 'worksheet.pdf', kind: 'pdf' } })
  })
})

describe('plugins', () => {
  it('lists the installed plugins for the "+" menu', async () => {
    const rig = await makeApiRig()
    const ids = (await rig.api['plugins:list']()).map((p) => p.id)
    expect(ids).toEqual(expect.arrayContaining(['quiz', 'speaker-notes']))
  })

  it('returns a manifest with the options last used, and a clear failure for an unknown plugin', async () => {
    const rig = await makeApiRig()
    const found = await rig.api['plugins:getManifest']({ pluginId: 'speaker-notes' })
    expect(found).toMatchObject({
      ok: true,
      manifest: { id: 'speaker-notes', action: 'Add notes' },
      lastInputs: null
    })
    expect(await rig.api['plugins:getManifest']({ pluginId: 'nope' })).toMatchObject({
      ok: false,
      code: 'not-found'
    })
  })

  it('runs a plugin as a job and ends with a chat event and remembers its options', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    const view = await rig.api.openLesson({ lessonId: id })
    if (!view.ok) throw new Error(view.message)
    const started = await rig.api['plugins:run']({
      pluginId: 'speaker-notes',
      lessonId: id,
      inputs: {},
      context: { currentSlideId: view.deck.slides[0].id, selectedSlideIds: [] }
    })
    if (!started.ok) throw new Error(started.message)
    await rig.services.plugins.whenDone(started.jobId)
    // the turn always ends: with its message (chat:done) or with a friendly error (ai:error)
    const names = rig.events.map((e) => e.name)
    expect(names.includes('chat:done') || names.includes('ai:error')).toBe(true)
    const again = await rig.api['plugins:getManifest']({ pluginId: 'speaker-notes' })
    expect(again.ok && again.lastInputs).not.toBeNull()
  })

  it('does not start a plugin that does not exist', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    const result = await rig.api['plugins:run']({
      pluginId: 'nope',
      lessonId: id,
      inputs: {},
      context: { currentSlideId: 's1', selectedSlideIds: [] }
    })
    expect(result).toMatchObject({ ok: false })
  })
})
