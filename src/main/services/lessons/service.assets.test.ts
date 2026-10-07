import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { fixtureDeck } from '@shared/deck/testing'
import type { ImageElement } from '@shared/deck/types'
import { makeLibrary, ONLINE_CREDIT } from '../chat/assetsTesting'
import { makeRig, seedLesson, tempDir } from './testing'

async function texts(path: string, pattern: RegExp): Promise<string[]> {
  const zip = await JSZip.loadAsync(readFileSync(path))
  const names = Object.keys(zip.files).filter((f) => pattern.test(f))
  return Promise.all(names.map((n) => zip.files[n].async('string')))
}

describe('exporting with picture spots', () => {
  it('answers `spots` before any dialog opens, until she fills or removes them or chooses to export anyway', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const target = join(tempDir(), 'Lesson.pptx')
    rig.dialogs.savePath = target

    // The fixture's third slide holds one empty spot.
    expect(await rig.service.exportPptx(id)).toEqual({ status: 'spots', count: 1, slides: [3] })
    expect(rig.dialogs.saveNames).toEqual([])
    expect(existsSync(target)).toBe(false)

    const anyway = await rig.service.exportPptx(id, { ignoreSpots: true })
    expect(anyway).toMatchObject({ status: 'saved', path: target })
    // The spot is not in the file: no caption, no box with her description.
    const slides = await texts(target, /^ppt\/slides\/slide\d+\.xml$/)
    expect(slides.join('')).not.toMatch(/picture spot|Picture spot/i)

    const removed = await rig.service.apply(id, {
      by: 'user',
      summary: 'Removed the spot',
      ops: [{ op: 'removeElement', slideId: 's3', elementId: 's3-photo' }]
    })
    expect(removed.ok).toBe(true)
    rig.dialogs.saveNames.length = 0
    expect(await rig.service.exportPptx(id)).toMatchObject({ status: 'saved' })
    expect(rig.dialogs.saveNames).toHaveLength(1)
  })

  it('puts a picture credit in the notes from the library when the line is missing', async () => {
    const lib = await makeLibrary()
    const rig = makeRig({ assets: lib.port })
    const id = await seedLesson(rig, fixtureDeck())
    const saved = await lib.port.saveOnline('res_leaf')
    if (!saved.ok) throw new Error(saved.message)
    const { asset } = saved
    const bytes = (await lib.port.readOriginal(asset.id))!
    await rig.service.files.copyLibraryPicture(id, {
      id: asset.id,
      ext: asset.file.ext,
      title: asset.title,
      bytes
    })
    const picture: ImageElement = {
      id: 's2-leaf',
      type: 'image',
      x: 900,
      y: 300,
      w: 500,
      h: 350,
      assetId: asset.id,
      fit: 'contain',
      alt: 'Leaf'
    }
    await rig.service.apply(id, {
      by: 'user',
      summary: 'Added a picture',
      ops: [
        { op: 'removeElement', slideId: 's3', elementId: 's3-photo' },
        { op: 'addElement', slideId: 's2', element: picture }
      ]
    })
    const target = join(tempDir(), 'Credits.pptx')
    rig.dialogs.savePath = target
    const result = await rig.service.exportPptx(id)
    expect(result).toMatchObject({ status: 'saved' })
    const notes = (await texts(target, /^ppt\/notesSlides\/notesSlide\d+\.xml$/)).join('\n')
    expect(notes).toContain(`Picture credit: ${ONLINE_CREDIT.text}`)
  })
})

describe('copy-on-use files', () => {
  it('writes a library picture into the lesson under its own id and never overwrites it', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const first = Uint8Array.from([1, 2, 3, 4])
    expect(
      await rig.service.files.copyLibraryPicture(id, {
        id: 'ast_x',
        ext: '.png',
        title: 'X',
        bytes: first
      })
    ).toEqual({ ok: true })
    const again = await rig.service.files.copyLibraryPicture(id, {
      id: 'ast_x',
      ext: '.png',
      title: 'X',
      bytes: Uint8Array.from([9, 9])
    })
    expect(again.ok).toBe(true)
    expect(Array.from((await rig.service.files.readAsset(id, 'ast_x'))!)).toEqual(Array.from(first))
    const dir = join(rig.dir, 'lessons', id, 'assets')
    expect(readdirSync(dir).filter((f) => f.startsWith('ast_x'))).toEqual(['ast_x.png'])
  })

  it('writes the copy again when its file has gone missing', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const picture = { id: 'ast_z', ext: '.png', title: 'Z', bytes: Uint8Array.from([5, 6]) }
    await rig.service.files.copyLibraryPicture(id, picture)
    await rm(join(rig.dir, 'lessons', id, 'assets', 'ast_z.png'))
    expect(await rig.service.files.readAsset(id, 'ast_z')).toBeUndefined()
    await rig.service.files.copyLibraryPicture(id, picture)
    expect(Array.from((await rig.service.files.readAsset(id, 'ast_z'))!)).toEqual([5, 6])
  })

  it('refuses ids and extensions that are not safe', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const bad = (over: object) =>
      rig.service.files.copyLibraryPicture(id, {
        id: 'ast_y',
        ext: '.png',
        title: 'Y',
        bytes: Uint8Array.from([1]),
        ...over
      })
    expect(await bad({ id: '../escape' })).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(await bad({ ext: '.exe/../x' })).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(
      await rig.service.files.copyLibraryPicture('../nope', {
        id: 'ast_y',
        ext: '.png',
        title: 'Y',
        bytes: Uint8Array.from([1])
      })
    ).toMatchObject({ ok: false, code: 'not-found' })
  })
})

describe('the library’s view of lessons', () => {
  it('lists the pictures each slide uses, gives a slide’s words, and tells the library when a lesson changes', async () => {
    let told = 0
    const lib = await makeLibrary()
    const rig = makeRig({ assets: { ...lib.port, lessonsChanged: () => void told++ } })
    const id = await seedLesson(rig, fixtureDeck())
    const picture: ImageElement = {
      id: 's1-logo',
      type: 'image',
      x: 1600,
      y: 40,
      w: 240,
      h: 240,
      assetId: lib.logo.id,
      fit: 'contain',
      alt: 'School logo'
    }
    await rig.service.apply(id, {
      by: 'user',
      summary: 'Added the logo',
      ops: [{ op: 'addElement', slideId: 's1', element: picture }]
    })
    expect(told).toBeGreaterThan(0)

    const used = await rig.service.lessonsUsingAssets()
    expect(used).toHaveLength(1)
    expect(used[0]).toMatchObject({ lessonId: id })
    expect(used[0].slides.find((s) => s.slideId === 's1')).toMatchObject({
      number: 1,
      assetIds: [lib.logo.id]
    })

    const context = await rig.service.slideContext(id, 's3')
    expect(context?.spotWords).toContain('leaf')
    expect(await rig.service.slideContext(id, 'nope')).toBeUndefined()
    expect(await rig.service.slideContext('../x', 's3')).toBeUndefined()
  })
})
