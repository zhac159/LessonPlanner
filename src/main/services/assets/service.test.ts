import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { failureOf } from './service'
import { AssetError } from './store'
import {
  addPicture,
  badgePng,
  cleanTemp,
  photoPng,
  svgBytes,
  tempDir,
  testService
} from './testing'
import type { LessonsPort } from './usage'

afterEach(cleanTemp)

async function ready(over: Parameters<typeof testService>[1] = {}) {
  const dir = await tempDir()
  const service = testService(dir, over)
  await service.init()
  return { dir, service }
}

const port = (): LessonsPort => ({
  lessonsUsingAssets: async () => [
    {
      lessonId: 'les_a',
      title: 'Photosynthesis',
      slides: [{ slideId: 'sld_1', number: 1, assetIds: [] }]
    }
  ],
  slideContext: async (lessonId, slideId) =>
    lessonId === 'les_a' && slideId === 'sld_1'
      ? { text: 'How a leaf makes food', spotWords: 'leaf in sunlight' }
      : undefined
})

describe('listing', () => {
  it('lists with data-URL thumbnails and the counts the page needs', async () => {
    const { service } = await ready()
    const logo = await addPicture(service, 'school_logo', { kind: 'logo', bytes: badgePng() })
    await addPicture(service, 'forest_photo', { kind: 'photo' })
    const page = await service.list()
    expect(page.libraryCount).toBe(2)
    expect(page.total).toBe(2)
    expect(page.counts).toMatchObject({ all: 2, logos: 1, pictures: 1 })
    expect(page.froms.map((f) => f.key)).toEqual(['anywhere', 'uploaded'])
    expect(page.pendingReview).toBeNull()
    const card = page.items.find((i) => i.id === logo.id)!
    expect(card.thumbDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(card).toMatchObject({
      name: 'school_logo',
      kind: 'logo',
      width: 64,
      sourceKind: 'uploaded'
    })
  })

  it('makes a thumbnail again when the file on disk is gone and reports the banner it was given', async () => {
    const { dir, service } = await ready()
    const asset = await addPicture(service, 'owl_mascot')
    await rm(join(dir, 'library', asset.id, 'thumb.png'))
    service.setPendingReview(() => ({ batchId: 'b1', found: 12, styleName: 'Science KS3' }))
    const fresh = testService(dir)
    await fresh.init()
    fresh.setPendingReview(() => ({ batchId: 'b1', found: 12, styleName: 'Science KS3' }))
    const page = await fresh.list({ search: 'owl' })
    expect(page.items[0]?.thumbDataUrl).toMatch(/^data:image\/png/)
    expect(page.pendingReview).toEqual({ batchId: 'b1', found: 12, styleName: 'Science KS3' })
  })

  it('names the style in the From select', async () => {
    const { service } = await ready()
    service.setStyleNames(() => new Map([['sty_1', 'Science KS3']]))
    await addPicture(service, 'cut_logo', {
      source: { kind: 'extracted', styleId: 'sty_1', fileName: 'Y8.pptx', page: 1, at: 'x' }
    })
    expect((await service.list()).froms[1]).toMatchObject({
      key: 'style:sty_1',
      label: 'Science KS3 style'
    })
  })

  it('gets the detail with the 768 px preview, or not-found', async () => {
    const { service } = await ready()
    const asset = await addPicture(service, 'big_leaf', {
      bytes: photoPng(1, 900, 450),
      description: 'A leaf.'
    })
    const got = await service.get(asset.id)
    expect(got.ok && got.asset).toMatchObject({ description: 'A leaf.', bytes: asset.file.bytes })
    expect(got.ok && got.asset.previewDataUrl).toMatch(/^data:image\/png/)
    expect(await service.get('ast_none')).toMatchObject({ ok: false, code: 'not-found' })
  })
})

describe('chips and names', () => {
  it('draws the current name, and a greyed chip for a deleted asset', async () => {
    const { service } = await ready()
    const asset = await addPicture(service, 'owl_mascot')
    await service.rename(asset.id, 'wise_owl')
    await service.remove((await addPicture(service, 'gone_one')).id)
    const chips = await service.chips([
      { assetId: asset.id, name: 'owl_mascot' },
      { assetId: 'ast_gone', name: 'gone_one' }
    ])
    expect(chips[0]).toMatchObject({ name: 'wise_owl', removed: false })
    expect(chips[1]).toMatchObject({ name: 'gone_one', removed: true, kind: null })
  })

  it('resolves typed names (braces and case are forgiven) and leaves unknown ones out', async () => {
    const { service } = await ready()
    await addPicture(service, 'school_logo')
    const chips = await service.resolveNames(['{{School_Logo}}', 'nothing_here', 'school_logo'])
    expect(chips.map((c) => c.name)).toEqual(['school_logo'])
  })

  it('checks a name live, forgiving the asset own name', async () => {
    const { service } = await ready()
    const owl = await addPicture(service, 'owl_mascot')
    await addPicture(service, 'leaf_icon')
    expect(service.checkName('Owl Mascot')).toMatchObject({ ok: false, problem: 'taken' })
    expect(service.checkName('Owl Mascot', owl.id)).toEqual({ ok: true, name: 'owl_mascot' })
    expect(service.checkName('x')).toMatchObject({ ok: false, problem: 'too-short' })
    expect(service.checkName('open')).toMatchObject({ ok: false, problem: 'reserved' })
  })
})

describe('editing', () => {
  it('renames with the spec messages and never touches the id', async () => {
    const { service } = await ready()
    const owl = await addPicture(service, 'owl_mascot')
    await addPicture(service, 'leaf_icon')
    const clash = await service.rename(owl.id, 'leaf_icon')
    expect(clash).toEqual({
      ok: false,
      code: 'invalid-input',
      message: 'You already have an asset called leaf_icon.'
    })
    const renamed = await service.rename(owl.id, 'Wise Owl')
    expect(renamed.ok && renamed.asset).toMatchObject({ id: owl.id, name: 'wise_owl' })
    expect(await service.rename('ast_none', 'some_name')).toMatchObject({ code: 'not-found' })
  })

  it('edits title, description, kind and tags and refuses an unknown kind', async () => {
    const { service } = await ready()
    const asset = await addPicture(service, 'owl_mascot')
    const done = await service.update({
      assetId: asset.id,
      title: 'Owl',
      description: 'A wise owl.',
      kind: 'character',
      tags: ['Owl', 'bird']
    })
    expect(done.ok && done.asset).toMatchObject({
      title: 'Owl',
      kind: 'character',
      tags: ['owl', 'bird']
    })
    expect((await service.get(asset.id)).ok && (await service.get(asset.id))).toMatchObject({
      asset: { description: 'A wise owl.' }
    })
    expect(await service.update({ assetId: asset.id, kind: 'nope' as never })).toMatchObject({
      code: 'invalid-input'
    })
  })

  it('replaces the file in the library, with a new thumbnail, or refuses a file that is not a picture', async () => {
    const { service } = await ready()
    const asset = await addPicture(service, 'banner_one')
    const before = (await service.list()).items[0]!.thumbDataUrl
    expect(await service.replaceFile(asset.id, new Uint8Array([1, 2, 3]))).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
    const done = await service.replaceFile(asset.id, svgBytes('#c00'))
    expect(done.ok && done.asset).toMatchObject({ id: asset.id, name: 'banner_one' })
    expect(done.ok && done.asset.thumbDataUrl).not.toBe(before)
    expect(service.getAsset(asset.id)?.file).toMatchObject({ ext: '.svg', vector: true })
  })

  it('marks use without changing updatedAt, and never throws for an unknown asset', async () => {
    const { service } = await ready()
    const asset = await addPicture(service, 'owl_mascot')
    await service.markUsed(asset.id, new Date('2026-10-08T10:00:00.000Z'))
    await service.markUsed('ast_none')
    expect(service.getAsset(asset.id)).toMatchObject({
      lastUsedAt: '2026-10-08T10:00:00.000Z',
      updatedAt: asset.updatedAt
    })
  })

  it('adds pictures with the same look-up helpers deck-builder will use', async () => {
    const { service } = await ready()
    const asset = await addPicture(service, 'owl_mascot')
    expect(service.findBySha(asset.file.sha256)?.id).toBe(asset.id)
    expect(service.takenNames()).toEqual(['owl_mascot'])
    expect(await service.readOriginal(asset.id)).toBeInstanceOf(Uint8Array)
    expect(await service.readOriginal('ast_none')).toBeUndefined()
  })
})

describe('delete and undo', () => {
  it('removes, restores, and tells listeners the library changed', async () => {
    const { service } = await ready()
    const heard: number[] = []
    service.onChanged((n) => heard.push(n))
    const asset = await addPicture(service, 'owl_mascot')
    expect(await service.remove(asset.id)).toEqual({ ok: true })
    expect((await service.list()).libraryCount).toBe(0)
    expect(await service.restore(asset.id)).toEqual({ ok: true })
    expect((await service.list()).items[0]?.name).toBe('owl_mascot')
    expect(heard).toEqual([1, 0, 1])
    expect(await service.remove('ast_none')).toMatchObject({ code: 'not-found' })
  })

  it('says why a restore failed when the name is taken', async () => {
    const { service } = await ready()
    const asset = await addPicture(service, 'owl_mascot')
    await service.remove(asset.id)
    await addPicture(service, 'owl_mascot', { bytes: photoPng(99) })
    expect(await service.restore(asset.id)).toEqual({
      ok: false,
      code: 'invalid-input',
      message: 'That name is taken now. Rename the other asset first.'
    })
  })
})

describe('usage and suggestions', () => {
  it('rebuilds usedIn from the lessons and answers "Used in"', async () => {
    const { service } = await ready()
    const asset = await addPicture(service, 'school_logo')
    const lessons: LessonsPort = {
      ...port(),
      lessonsUsingAssets: async () => [
        {
          lessonId: 'les_a',
          title: 'Photosynthesis',
          slides: [
            { slideId: 's1', number: 1, assetIds: [asset.id] },
            { slideId: 's2', number: 2, assetIds: [asset.id] }
          ]
        },
        {
          lessonId: 'les_b',
          title: 'Cells',
          slides: [{ slideId: 's1', number: 1, assetIds: [asset.id] }]
        }
      ]
    }
    service.setLessonsPort(lessons)
    const heard = vi.fn()
    service.onChanged(heard)
    expect(await service.refreshUsage()).toBe(true)
    expect(heard).toHaveBeenCalledTimes(1)
    expect(await service.refreshUsage()).toBe(false)
    expect((await service.list()).items[0]?.usedInCount).toBe(2)
    const usage = await service.usage(asset.id)
    expect(usage.ok && usage.usage.lessons).toEqual([
      { lessonId: 'les_a', title: 'Photosynthesis', slideNumbers: [1, 2] },
      { lessonId: 'les_b', title: 'Cells', slideNumbers: [1] }
    ])
    service.dispose()
  })

  it('has empty usage without a lessons port and fails politely when the scan breaks', async () => {
    const { service } = await ready()
    const asset = await addPicture(service, 'school_logo')
    expect(await service.usage(asset.id)).toEqual({ ok: true, usage: { lessons: [], foundIn: [] } })
    const warn = vi.fn()
    const broken = testService(await tempDir(), {
      log: { warn },
      lessons: { ...port(), lessonsUsingAssets: async () => Promise.reject(new Error('disk')) }
    })
    await broken.init()
    expect(await broken.refreshUsage()).toBe(false)
    expect(warn).toHaveBeenCalled()
  })

  it('suggests assets for a slide from its words and the spot, or says the slide is gone', async () => {
    const { service } = await ready({ lessons: port() })
    await addPicture(service, 'leaf_icon', { kind: 'icon', tags: ['plants'] })
    await addPicture(service, 'owl_mascot', { kind: 'character' })
    const found = await service.suggest({ lessonId: 'les_a', slideId: 'sld_1' })
    expect(found.ok && found.assets.map((a) => a.name)).toEqual(['leaf_icon'])
    expect(await service.suggest({ lessonId: 'les_a', slideId: 'nope' })).toMatchObject({
      code: 'not-found'
    })
    const typed = await service.suggest({
      lessonId: 'les_a',
      slideId: 'sld_1',
      words: 'owl',
      limit: 1
    })
    expect(typed.ok && typed.assets).toHaveLength(1)
  })

  it('suggests from typed words alone when no lessons port is registered', async () => {
    const { service } = await ready()
    await addPicture(service, 'owl_mascot', { kind: 'character' })
    const found = await service.suggest({ lessonId: 'x', slideId: 'y', words: 'a wise owl' })
    expect(found.ok && found.assets.map((a) => a.name)).toEqual(['owl_mascot'])
  })
})

describe('start-up', () => {
  it('reports a tidied library once', async () => {
    const dir = await tempDir()
    const first = testService(dir)
    await first.init()
    await addPicture(first, 'owl_mascot')
    await writeFile(join(dir, 'index.json'), 'broken')
    const again = testService(dir)
    await again.init()
    expect(again.takeLoadReport()).toMatchObject({ recovered: 1, setAside: 0 })
    expect(again.takeLoadReport()).toBeNull()
  })

  it('never crashes when the folder cannot be used, and says so in the log', async () => {
    const dir = await tempDir()
    await writeFile(join(dir, 'in-the-way'), 'a file, not a folder')
    const warn = vi.fn()
    const service = testService(join(dir, 'in-the-way'), { log: { warn } })
    expect(await service.init()).toEqual({ recovered: 0, setAside: 0, renamed: 0 })
    expect(warn).toHaveBeenCalled()
    expect((await service.list()).libraryCount).toBe(0)
  })

  it('rescans the lessons a moment after they change', async () => {
    vi.useFakeTimers()
    try {
      const scans = vi.fn(async () => [])
      const { service } = await ready({ lessons: { ...port(), lessonsUsingAssets: scans } })
      service.scheduleUsageRefresh()
      service.scheduleUsageRefresh()
      await vi.advanceTimersByTimeAsync(800)
      expect(scans).toHaveBeenCalledTimes(2)
      service.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('turns errors into plain failures', () => {
    expect(failureOf(new AssetError('too-large', 'That picture is too big.'))).toEqual({
      ok: false,
      code: 'too-large',
      message: 'That picture is too big.'
    })
    const warn = vi.fn()
    expect(failureOf(new Error('EPERM secret path'), warn)).toMatchObject({ code: 'io' })
    expect(JSON.stringify(failureOf(new Error('EPERM secret path')))).not.toContain('secret')
    expect(warn).toHaveBeenCalled()
  })
})
