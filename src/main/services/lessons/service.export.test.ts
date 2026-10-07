import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { fixtureDeck, makeSlide } from '@shared/deck/testing'
import { missingFontsOf } from './exporter'
import { makeRig, seedLesson, tempDir } from './testing'

/** The fixture deck still has an empty picture spot: these tests are about saving, so they answer "Export anyway". */
const ANYWAY = { ignoreSpots: true }

describe('exportPptx', () => {
  it('asks where to save, writes a real .pptx and remembers the path', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const target = join(tempDir(), 'Photosynthesis.pptx')
    rig.dialogs.savePath = target
    const result = await rig.service.exportPptx(id, ANYWAY)
    expect(result).toMatchObject({
      status: 'saved',
      path: target,
      fileName: 'Photosynthesis.pptx'
    })
    expect(rig.dialogs.saveNames).toEqual(['Y8 Science — Photosynthesis.pptx'])
    const zip = await JSZip.loadAsync(readFileSync(target))
    expect(
      Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    ).toHaveLength(3)
    expect(rig.service.wasExported(target)).toBe(true)
    expect(rig.service.wasExported(join(tempDir(), 'other.pptx'))).toBe(false)
  })

  it('adds .pptx when the dialog returns a bare name', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    const bare = join(tempDir(), 'Lesson')
    rig.dialogs.savePath = bare
    const result = await rig.service.exportPptx(id, ANYWAY)
    expect(result).toMatchObject({ status: 'saved', path: `${bare}.pptx` })
    expect(existsSync(`${bare}.pptx`)).toBe(true)
  })

  it('is cancelled quietly when the dialog is closed', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    expect(await rig.service.exportPptx(id, ANYWAY)).toEqual({ status: 'cancelled' })
  })

  it('refuses a lesson without slides and an unknown lesson', async () => {
    const rig = makeRig()
    const created = await rig.service.create({ styleId: null, meta: {} })
    if (!created.ok) throw new Error('create failed')
    rig.dialogs.savePath = join(tempDir(), 'x.pptx')
    expect(await rig.service.exportPptx(created.lessonId)).toMatchObject({
      status: 'error',
      code: 'io',
      message: 'There are no slides to export yet.'
    })
    expect(await rig.service.exportPptx('les_nope')).toMatchObject({ status: 'error' })
    expect(rig.dialogs.saveNames).toEqual([])
  })

  it('reports a file that cannot be written as an error, not an exception', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    rig.dialogs.savePath = join(rig.dir, 'lessons', id, 'deck.json', 'inside-a-file.pptx')
    const result = await rig.service.exportPptx(id, ANYWAY)
    expect(result.status).toBe('error')
  })

  it('lists fonts that are not installed', async () => {
    const rig = makeRig({ installedFonts: new Set(['arial']) })
    const id = await seedLesson(rig, fixtureDeck())
    rig.dialogs.savePath = join(tempDir(), 'fonts.pptx')
    const result = await rig.service.exportPptx(id, ANYWAY)
    expect(result.status === 'saved' && result.missingFonts).toEqual(['Lexend'])
  })
})

describe('missingFontsOf', () => {
  it('extracts family names from the exporter warnings and ignores other warnings', () => {
    expect(
      missingFontsOf([
        'The font “Lexend” may not be installed on this computer, so PowerPoint could substitute another one.',
        'A picture was missing',
        'The font “Bricolage Grotesque” may not be installed on this computer, so PowerPoint could substitute another one.'
      ])
    ).toEqual(['Lexend', 'Bricolage Grotesque'])
  })
})

describe('thumbnails', () => {
  it('draws the first slide at 480x270 after a change and writes thumb.png', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    await rig.service.flushThumbnails()
    expect(rig.renderer.calls.at(-1)).toMatchObject({
      width: 480,
      height: 270,
      slide: { id: 's1' }
    })
    expect(rig.renderer.calls.at(-1)?.style?.id).toBe(rig.style.id)
    expect(existsSync(join(rig.dir, 'lessons', id, 'thumb.png'))).toBe(true)
  })

  it('does not redraw when the first slide did not change', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    await rig.service.flushThumbnails()
    const drawn = rig.renderer.calls.length
    await rig.service.apply(id, {
      by: 'user',
      summary: 'Retitle',
      ops: [{ op: 'setMeta', title: 'T' }]
    })
    await rig.service.flushThumbnails()
    expect(rig.renderer.calls).toHaveLength(drawn)
    await rig.service.apply(id, {
      by: 'user',
      summary: 'Add first',
      ops: [{ op: 'insertSlides', afterSlideId: null, slides: [makeSlide('new-first')] }]
    })
    await rig.service.flushThumbnails()
    expect(rig.renderer.calls).toHaveLength(drawn + 1)
  })

  it('only draws the newest state when changes come quickly', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    await rig.service.flushThumbnails()
    rig.renderer.calls.length = 0
    let release = (): void => undefined
    rig.renderer.gate = new Promise<void>((resolve) => (release = resolve))
    for (const n of [1, 2, 3, 4])
      await rig.service.apply(id, {
        by: 'user',
        summary: `Add ${n}`,
        ops: [{ op: 'insertSlides', afterSlideId: null, slides: [makeSlide(`f${n}`)] }]
      })
    release()
    await rig.service.flushThumbnails()
    expect(rig.renderer.calls.map((c) => c.slide.id)).toEqual(['f1', 'f4'])
  })

  it('removes the thumbnail when the deck has no slides left', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    await rig.service.flushThumbnails()
    await rig.service.undo(id)
    await rig.service.flushThumbnails()
    expect(existsSync(join(rig.dir, 'lessons', id, 'thumb.png'))).toBe(false)
  })

  it('a failing renderer never fails the save', async () => {
    const rig = makeRig()
    rig.renderer.failWith = new Error('GPU lost')
    const id = await seedLesson(rig, fixtureDeck())
    await rig.service.flushThumbnails()
    expect((await rig.service.list())[0].thumbDataUrl).toBeNull()
    expect((await rig.service.open(id)).ok).toBe(true)
  })

  it('works without a renderer', async () => {
    const rig = makeRig({ renderer: undefined })
    await seedLesson(rig, fixtureDeck())
    await rig.service.flushThumbnails()
    expect((await rig.service.list())[0].thumbDataUrl).toBeNull()
  })

  it('lets the renderer read lesson pictures', async () => {
    const rig = makeRig()
    const id = await seedLesson(rig, fixtureDeck())
    await rig.service.flushThumbnails()
    const request = rig.renderer.calls.at(-1)
    expect(await request?.readAsset?.('ast_none')).toBeUndefined()
    expect(id).toBeTruthy()
  })
})
