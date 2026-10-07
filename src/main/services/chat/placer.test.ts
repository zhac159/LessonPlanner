import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ANCHOR_MARGIN } from '@shared/assets/fit'
import type { PlaceAssetArgs } from '@shared/assets/place'
import { isPictureSpot } from '@shared/assets/spots'
import { fixtureDeck } from '@shared/deck/testing'
import type { ImageElement } from '@shared/deck/types'
import { makeRig, seedLesson, sequentialIds, type Rig } from '../lessons/testing'
import { ONLINE_CREDIT, makeLibrary, type Library } from './assetsTesting'
import { AssetPlacer, ASSET_GONE } from './placer'
import { ChatStore } from './store'

interface PlacerRig {
  rig: Rig
  lib: Library
  lessonId: string
  placer: AssetPlacer
  store: ChatStore
}

async function setup(): Promise<PlacerRig> {
  const lib = await makeLibrary()
  const rig = makeRig({ assets: lib.port })
  const lessonId = await seedLesson(rig, fixtureDeck())
  const store = new ChatStore((id) => rig.service.chatPath(id))
  const placer = new AssetPlacer({
    lessons: rig.service,
    assets: lib.port,
    store,
    ids: sequentialIds()
  })
  return { rig, lib, lessonId, placer, store }
}

const slideOf = async (r: PlacerRig, slideId: string) => {
  const opened = await r.rig.service.open(r.lessonId)
  if (!opened.ok) throw new Error(opened.message)
  return opened.deck.slides.find((s) => s.id === slideId)!
}

const anchorArgs = (r: PlacerRig, over: Partial<PlaceAssetArgs> = {}): PlaceAssetArgs => ({
  lessonId: r.lessonId,
  slideId: 's1',
  source: { kind: 'library', assetId: r.lib.logo.id },
  target: { kind: 'anchor', anchor: 'top-right', widthUnits: 240 },
  fit: 'fit',
  ...over
})

const lessonAssetFiles = (r: PlacerRig): string[] => {
  const dir = join(r.rig.dir, 'lessons', r.lessonId, 'assets')
  return existsSync(dir) ? readdirSync(dir).sort() : []
}

describe('placing an asset on a slide', () => {
  it('adds a picture at an anchor as ONE undo step, copies the file and says so in the chat', async () => {
    const r = await setup()
    const placed = await r.placer.placeAsset(anchorArgs(r))
    if (!placed.ok) throw new Error(placed.message)

    const slide = await slideOf(r, 's1')
    const picture = slide.elements.find((e) => e.id === placed.elementId) as ImageElement
    expect(picture).toMatchObject({
      type: 'image',
      assetId: r.lib.logo.id,
      name: 'school_logo',
      alt: 'School logo',
      fit: 'contain',
      w: 240
    })
    expect(picture.locked).toBeUndefined()
    expect(picture.x + picture.w).toBeCloseTo(1920 - ANCHOR_MARGIN)
    expect(picture.y).toBeCloseTo(ANCHOR_MARGIN)
    expect(placed.placed).toMatchObject({ w: 240, fit: 'contain', lowResolution: false })
    expect(placed.changeSet).toMatchObject({ by: 'user', summary: 'Added school_logo to slide 1' })
    expect(placed.history.canUndo).toBe(true)

    // The file is in the lesson folder under the LIBRARY id, and the lesson can read it.
    expect(lessonAssetFiles(r)).toContain(`${r.lib.logo.id}.png`)
    const bytes = await r.rig.service.files.readAsset(r.lessonId, r.lib.logo.id)
    expect(bytes?.byteLength).toBeGreaterThan(50)

    // The library knows it was used; the chat item is stored and carries its ResultChip.
    expect(r.lib.service.getAsset(r.lib.logo.id)?.lastUsedAt).not.toBeNull()
    expect(placed.asset.name).toBe('school_logo')
    expect(placed.chat).toMatchObject({
      role: 'assistant',
      text: 'Added {{school_logo}} to slide 1.',
      assets: [{ assetId: r.lib.logo.id, name: 'school_logo' }],
      result: { changeSetId: placed.changeSet.id, label: 'Slide 1 changed', undone: false }
    })
    expect((await r.store.read(r.lessonId)).at(-1)?.ui.text).toBe(
      'Added {{school_logo}} to slide 1.'
    )

    // One undo removes the picture again.
    const undone = await r.rig.service.undo(r.lessonId)
    if (!undone.ok) throw new Error(undone.message)
    expect((await slideOf(r, 's1')).elements.some((e) => e.id === placed.elementId)).toBe(false)
  })

  it('fills a picture spot in place: same element, its placeholder kept, one undo brings the spot back', async () => {
    const r = await setup()
    const placed = await r.placer.placeAsset(
      anchorArgs(r, {
        slideId: 's3',
        source: { kind: 'library', assetId: r.lib.leaf.id },
        target: { kind: 'spot', elementId: 's3-photo' }
      })
    )
    if (!placed.ok) throw new Error(placed.message)
    expect(placed.elementId).toBe('s3-photo')
    expect(placed.changeSet.summary).toBe('Added leaf_photo to slide 3')

    const filled = (await slideOf(r, 's3')).elements.find(
      (e) => e.id === 's3-photo'
    ) as ImageElement
    expect(filled).toMatchObject({ assetId: r.lib.leaf.id, name: 'leaf_photo', alt: 'Leaf photo' })
    expect(filled.placeholder?.description).toBeTruthy()
    expect(isPictureSpot(filled)).toBe(false)

    await r.rig.service.undo(r.lessonId)
    const back = (await slideOf(r, 's3')).elements.find((e) => e.id === 's3-photo') as ImageElement
    expect(isPictureSpot(back)).toBe(true)
    expect(back.assetId).toBeUndefined()
  })

  it('swaps the picture under a circle and says "Replaced the photo"', async () => {
    const r = await setup()
    await r.placer.placeAsset(
      anchorArgs(r, {
        slideId: 's3',
        source: { kind: 'library', assetId: r.lib.leaf.id },
        target: { kind: 'spot', elementId: 's3-photo' }
      })
    )
    const photo = (await slideOf(r, 's3')).elements.find((e) => e.id === 's3-photo') as ImageElement
    const bbox = { x: photo.x, y: photo.y, w: photo.w, h: photo.h }
    const swapped = await r.placer.placeAsset(
      anchorArgs(r, {
        slideId: 's3',
        source: { kind: 'library', assetId: r.lib.card.id },
        target: {
          kind: 'region',
          path: [
            [bbox.x, bbox.y],
            [bbox.x + bbox.w, bbox.y],
            [bbox.x + bbox.w, bbox.y + bbox.h],
            [bbox.x, bbox.y + bbox.h]
          ],
          bbox,
          replaceElementId: 's3-photo'
        },
        fit: 'fill'
      })
    )
    if (!swapped.ok) throw new Error(swapped.message)
    expect(swapped.changeSet.summary).toBe('Replaced the photo on slide 3 with happy_card')
    expect(swapped.chat.text).toBe('Replaced the photo on slide 3 with {{happy_card}}.')
    const now = (await slideOf(r, 's3')).elements.find((e) => e.id === 's3-photo') as ImageElement
    expect(now).toMatchObject({ assetId: r.lib.card.id, fit: 'cover', name: 'happy_card' })
    expect({ x: now.x, y: now.y, w: now.w, h: now.h }).toEqual(bbox)
  })

  it('copies an asset into the lesson once: placing it again reuses the copy', async () => {
    const r = await setup()
    await r.placer.placeAsset(anchorArgs(r))
    await r.placer.placeAsset(anchorArgs(r, { slideId: 's2' }))
    expect(lessonAssetFiles(r).filter((f) => f.startsWith(r.lib.logo.id))).toEqual([
      `${r.lib.logo.id}.png`
    ])
    // A new file in the library never reaches a lesson that already has a copy.
    const before = await r.rig.service.files.readAsset(r.lessonId, r.lib.logo.id)
    const replaced = await r.lib.service.replaceFile(
      r.lib.logo.id,
      (await r.lib.service.readOriginal(r.lib.leaf.id))!
    )
    expect(replaced.ok).toBe(true)
    await r.placer.placeAsset(
      anchorArgs(r, { slideId: 's3', target: { kind: 'anchor', anchor: 'top-left' } })
    )
    expect(await r.rig.service.files.readAsset(r.lessonId, r.lib.logo.id)).toEqual(before)
  })

  it('keeps working when the library loses the asset later: the lesson keeps its copy', async () => {
    const r = await setup()
    await r.placer.placeAsset(anchorArgs(r))
    await r.lib.service.remove(r.lib.logo.id)
    // Already placed pictures still read from the lesson's own copy.
    expect(
      (await r.rig.service.files.readAsset(r.lessonId, r.lib.logo.id))?.byteLength
    ).toBeGreaterThan(0)
    // Placing it again is refused in plain words and changes nothing.
    const slideBefore = await slideOf(r, 's2')
    const again = await r.placer.placeAsset(anchorArgs(r, { slideId: 's2' }))
    expect(again).toMatchObject({ ok: false, code: 'not-found', message: ASSET_GONE })
    expect(await slideOf(r, 's2')).toEqual(slideBefore)
  })

  it('adds the credit line of an online picture to the notes in the SAME change, and undo removes both', async () => {
    const r = await setup()
    const placed = await r.placer.placeAsset(
      anchorArgs(r, {
        slideId: 's3',
        source: { kind: 'online', resultId: 'res_leaf' },
        target: { kind: 'spot', elementId: 's3-photo' }
      })
    )
    if (!placed.ok) throw new Error(placed.message)
    expect(r.lib.savedOnline).toEqual(['res_leaf'])
    expect(placed.asset.name).toBe('sunlit_leaf')
    expect(placed.changeSet.ops.map((o) => o.op)).toEqual(['updateElement', 'updateSlide'])
    const before = (await slideOf(r, 's3')).notes
    expect((await slideOf(r, 's3')).notes).toContain(`Picture credit: ${ONLINE_CREDIT.text}`)

    // Placing a second copy of the same picture never repeats the line.
    await r.placer.placeAsset(
      anchorArgs(r, {
        slideId: 's3',
        source: { kind: 'library', assetId: placed.asset.id },
        target: { kind: 'anchor', anchor: 'bottom-left' }
      })
    )
    const notes = (await slideOf(r, 's3')).notes ?? ''
    expect(notes.split('Picture credit:')).toHaveLength(2)

    await r.rig.service.undo(r.lessonId)
    await r.rig.service.undo(r.lessonId)
    expect((await slideOf(r, 's3')).notes).toBe(before?.replace(/\n?Picture credit:.*/, ''))
  })

  it('refuses what it cannot place without touching the lesson', async () => {
    const r = await setup()
    const deckBefore = (await r.rig.service.open(r.lessonId)) as { deck: unknown }
    const cases: Array<[Partial<PlaceAssetArgs>, string]> = [
      [{ slideId: 'nope' }, 'not-found'],
      [{ target: { kind: 'spot', elementId: 's1-title' } }, 'not-found'],
      [{ source: { kind: 'library', assetId: 'ast_missing' } }, 'not-found'],
      [{ source: { kind: 'online', resultId: 'res_gone' } }, 'not-found'],
      [{ source: { kind: 'made', jobId: 'job_1', version: 0 } }, 'not-found'],
      [{ lessonId: 'les_nope' }, 'not-found'],
      [{ fit: 'stretch' as never }, 'invalid-input'],
      [{ target: { kind: 'anchor', anchor: 'middle' as never } }, 'invalid-input']
    ]
    for (const [over, code] of cases) {
      const result = await r.placer.placeAsset(anchorArgs(r, over))
      expect(result, JSON.stringify(over)).toMatchObject({ ok: false, code })
    }
    const after = (await r.rig.service.open(r.lessonId)) as {
      deck: unknown
      history: { canUndo: boolean }
    }
    expect(after.deck).toEqual(deckBefore.deck)
    expect(await r.store.read(r.lessonId)).toEqual([])
  })
})
