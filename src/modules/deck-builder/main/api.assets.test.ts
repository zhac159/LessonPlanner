import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeLibrary } from '@main/services/chat/assetsTesting'
import { tempDir } from '@main/services/lessons/testing'
import { makeApiRig, seedFixtureLesson } from './testing'

describe('placeAsset', () => {
  it('places a picture, stores the chat message and returns everything the editor needs', async () => {
    const lib = await makeLibrary()
    const rig = await makeApiRig({ assets: lib.port })
    const id = await seedFixtureLesson(rig)
    const placed = await rig.api.placeAsset({
      lessonId: id,
      slideId: 's3',
      source: { kind: 'library', assetId: lib.leaf.id },
      target: { kind: 'spot', elementId: 's3-photo' },
      fit: 'fit'
    })
    if (!placed.ok) throw new Error(placed.message)
    expect(placed).toMatchObject({
      elementId: 's3-photo',
      asset: { id: lib.leaf.id, name: 'leaf_photo' },
      chat: { text: 'Added {{leaf_photo}} to slide 3.', result: { label: 'Slide 3 changed' } },
      history: { canUndo: true }
    })
    const view = await rig.api.openLesson({ lessonId: id })
    if (!view.ok) throw new Error(view.message)
    expect(view.chat.at(-1)).toMatchObject({ text: 'Added {{leaf_photo}} to slide 3.' })
    // The spot is filled now, so the export no longer stops at it.
    rig.dialogs.savePath = join(tempDir(), 'Filled.pptx')
    expect(await rig.api.exportPptx({ lessonId: id })).toMatchObject({ status: 'saved' })
  })

  it('says so in words when the module has no library, and passes failures through', async () => {
    const none = await makeApiRig()
    const noneId = await seedFixtureLesson(none)
    const args = {
      lessonId: noneId,
      slideId: 's1',
      source: { kind: 'library' as const, assetId: 'ast_x' },
      target: { kind: 'anchor' as const, anchor: 'top-right' as const },
      fit: 'fit' as const
    }
    expect(await none.api.placeAsset(args)).toMatchObject({ ok: false, code: 'not-found' })

    const lib = await makeLibrary()
    const rig = await makeApiRig({ assets: lib.port })
    const id = await seedFixtureLesson(rig)
    expect(await rig.api.placeAsset({ ...args, lessonId: id })).toMatchObject({
      ok: false,
      code: 'not-found',
      message: 'That picture isn’t in your library any more.'
    })
  })
})

describe('exportPptx with picture spots', () => {
  it('stops before the Save dialog with the count and slide numbers, until ignoreSpots', async () => {
    const rig = await makeApiRig()
    const id = await seedFixtureLesson(rig)
    rig.dialogs.savePath = join(tempDir(), 'Anyway.pptx')
    expect(await rig.api.exportPptx({ lessonId: id })).toEqual({
      status: 'spots',
      count: 1,
      slides: [3]
    })
    expect(rig.dialogs.saveNames).toEqual([])
    expect(await rig.api.exportPptx({ lessonId: id, ignoreSpots: true })).toMatchObject({
      status: 'saved'
    })
    expect(rig.dialogs.saveNames).toHaveLength(1)
  })
})
