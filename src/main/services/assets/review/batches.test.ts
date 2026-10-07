import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LICENCES } from '@shared/assets/credits'
import type { ReviewOrigin } from '@shared/contracts/assets'
import { fail } from '@shared/result'
import { cleanTemp, newAssetInput, photoPng } from '../testing'
import { createFakeAiService } from '../../../ai/fake'
import { extractAssets } from '../../../import/assets'
import { deckBytes, foundIn, harness, upload, writeTemp } from './testing'

afterEach(cleanTemp)

const style: ReviewOrigin = { kind: 'style', styleId: 'sty_sci', styleName: 'Science KS3' }

describe('a batch survives a restart', () => {
  it('keeps pictures, names and ticks, and the banner', async () => {
    const h = await harness()
    await upload(h)
    const [first] = h.review.view().candidates
    await h.review.edit({ candidateId: first!.id, name: 'My Name', keep: false })
    expect(h.review.banner()).toMatchObject({ found: 3, styleName: null })

    const again = h.make()
    await again.init()
    const view = again.view()
    expect(view.candidates.map((c) => c.name)).toContain('my_name')
    expect(view.candidates.find((c) => c.id === first!.id)).toMatchObject({ keep: false })
    expect(view.candidates.every((c) => c.thumbDataUrl !== null)).toBe(true)
    expect(again.banner()).toMatchObject({ found: 3 })
  })

  it('marks files that were still being read as not finished', async () => {
    const h = await harness()
    await upload(h)
    const batch = h.review.view().batches[0]!
    // simulate a crash: the file was "working" when the app closed
    const { ReviewDisk } = await import('./disk')
    const disk = new ReviewDisk(join(h.dir, 'assets'))
    const [stored] = await disk.loadAll()
    stored!.files[0]!.state = 'working'
    stored!.working = true
    await disk.save(stored!)
    const again = h.make()
    await again.init()
    expect(again.view().batches[0]).toMatchObject({ id: batch.id, working: false })
    expect(again.view().batches[0]?.files[0]).toMatchObject({ state: 'failed' })
    expect(again.view().found).toBe(3)
  })

  it('removes a batch nobody looked at for 30 days', async () => {
    const h = await harness()
    await upload(h)
    const later = h.make({ now: () => new Date(Date.now() + 31 * 24 * 3600_000) })
    await later.init()
    expect(later.view().batches).toEqual([])
    expect(await readdir(join(h.dir, 'assets', 'review'))).toEqual([])
  })
})

describe('editing a candidate', () => {
  it('checks names against the library and the other pictures waiting', async () => {
    const h = await harness()
    await h.assets.add(newAssetInput('owl_mascot'))
    await upload(h)
    const [a, b] = h.review.view().candidates
    const taken = await h.review.edit({ candidateId: a!.id, name: 'owl_mascot' })
    expect(taken).toMatchObject({
      ok: false,
      code: 'invalid-input',
      message: 'You already have an asset called owl_mascot.'
    })
    expect(await h.review.edit({ candidateId: a!.id, name: b!.name })).toMatchObject({ ok: false })
    expect(await h.review.edit({ candidateId: a!.id, name: 'x' })).toMatchObject({ ok: false })
    const fixed = await h.review.edit({
      candidateId: a!.id,
      name: 'Wise Owl',
      kind: 'character',
      title: 'Wise owl',
      description: 'A brown owl.'
    })
    expect(fixed).toMatchObject({
      ok: true,
      candidate: { name: 'wise_owl', kind: 'character', title: 'Wise owl' }
    })
    expect(await h.review.edit({ candidateId: 'nope', keep: true })).toMatchObject({
      ok: false,
      code: 'not-found'
    })
  })

  it('does not change anything when one field of an edit is refused', async () => {
    const h = await harness()
    await upload(h)
    const [a, b] = h.review.view().candidates
    const refused = await h.review.edit({ candidateId: a!.id, title: 'Changed', name: b!.name })
    expect(refused).toMatchObject({ ok: false })
    expect(h.review.view().candidates.find((c) => c.id === a!.id)?.title).toBe(a!.title)
  })

  it('keeps her own wording when Claude describes the picture later', async () => {
    const h = await harness({
      ai: { describeAssets: async () => fail('unknown', 'offline') }
    })
    await upload(h)
    const [a] = h.review.view().candidates
    await h.review.edit({ candidateId: a!.id, name: 'my_pick', description: 'Mine.' })
    const working = h.make({ ai: createFakeAiService() })
    await working.init()
    working.nameWithClaude(h.review.view().batches[0]!.id)
    await working.idle()
    const after = working.view().candidates.find((c) => c.id === a!.id)
    expect(after).toMatchObject({ name: 'my_pick', description: 'Mine.' })
    expect(
      working
        .view()
        .candidates.filter((c) => c.id !== a!.id)
        .every((c) => c.description !== '')
    ).toBe(true)
  })
})

describe('keeping the ticked pictures', () => {
  it('saves exactly the ticked ones with their source, deck links and licence, and clears the batch', async () => {
    const h = await harness()
    await upload(h)
    const [a, ...rest] = h.review.view().candidates
    await h.review.edit({ candidateId: a!.id, keep: false })
    const saved = await h.review.accept()
    expect(saved).toMatchObject({ ok: true })
    const added = saved.ok && 'added' in saved ? saved.added : []
    expect(added).toHaveLength(rest.length)
    expect(h.assets.libraryCount).toBe(2)
    const asset = h.assets.getAsset(added[0]!.id)!
    expect(asset).toMatchObject({
      source: { kind: 'extracted', styleId: null, fileName: 'Y8 Cells.pptx' },
      licence: LICENCES.unknown,
      credit: null
    })
    expect(asset.foundIn[0]).toMatchObject({ fileName: 'Y8 Cells.pptx', styleId: null })
    expect(asset.description).not.toBe('')
    expect(h.review.view().batches).toEqual([])
    expect(h.review.banner()).toBeNull()
    expect(await readdir(join(h.dir, 'assets', 'review'))).toEqual([])
  })

  it('leaves a batch that is still being read open for the rest', async () => {
    let release = (): void => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    let reached = (): void => undefined
    const atSecond = new Promise<void>((resolve) => (reached = resolve))
    const h = await harness({
      extract: async (file, options) => {
        if (file.name === 'second.pptx') {
          reached()
          await gate
        }
        return extractAssets(file, options)
      }
    })
    const first = await writeTemp(h.dir, 'first.pptx', await deckBytes([71]))
    const second = await writeTemp(h.dir, 'second.pptx', await deckBytes([72]))
    const started = await h.review.addPaths([first, second])
    await atSecond
    expect(h.review.view().stillReading).toBe(1)
    const saved = await h.review.accept()
    expect(saved).toMatchObject({ ok: true })
    expect(saved.ok && 'added' in saved && saved.added).toHaveLength(2)
    expect(h.review.view().batches).toHaveLength(1)
    expect(h.review.view().found).toBe(0)
    release()
    await h.review.idle()
    expect(started.ok && h.review.view().batches[0]?.id).toBe(started.ok && started.batchId)
    expect(h.review.view().found).toBe(1)
    expect(h.review.view().batches[0]?.working).toBe(false)
  })

  it('flags a picture already in the library, never ticks it and refuses to tick it', async () => {
    const h = await harness()
    await upload(h)
    await h.review.accept()
    await upload(h)
    const view = h.review.view()
    expect(view.candidates).toHaveLength(3)
    for (const c of view.candidates) {
      expect(c).toMatchObject({ keep: false, leftOut: { reason: 'duplicate' } })
      expect(c.leftOut?.ofName).toBeTruthy()
    }
    expect(h.calls).toHaveLength(1)
    const tick = await h.review.edit({ candidateId: view.candidates[0]!.id, keep: true })
    expect(tick).toMatchObject({ ok: false, message: 'That picture is already in Your assets.' })
    expect(await h.review.accept()).toMatchObject({ ok: true, added: [] })
    expect(h.assets.libraryCount).toBe(3)
  })

  it('gives a picture the next free name when its name was taken in the meantime', async () => {
    const h = await harness()
    await h.review.addPaths([await writeTemp(h.dir, 'owl.png', photoPng(3, 90, 70))])
    await h.review.idle()
    const [c] = h.review.view().candidates
    await h.review.edit({ candidateId: c!.id, name: 'owl_card' })
    await h.assets.add(newAssetInput('owl_card'))
    const saved = await h.review.accept()
    expect(saved.ok && 'added' in saved && saved.added[0]?.name).toBe('owl_card_2')
  })
})

describe('batches from style learning and from online picks', () => {
  it('opens a style batch with the deck links of that style and the banner text', async () => {
    const h = await harness()
    const found = await foundIn('Y8 Photosynthesis.pptx', await deckBytes([51, 52]))
    const { batchId } = await h.review.createReviewBatch({
      source: style,
      candidates: found,
      files: [{ name: 'Y8 Photosynthesis.pptx', sourceId: 'src_01' }]
    })
    expect(h.review.view().batches[0]).toMatchObject({ id: batchId, working: true })
    await h.review.idle()
    expect(h.review.banner()).toEqual({ batchId, found: 3, styleName: 'Science KS3' })
    const view = h.review.view()
    expect(view.batches[0]?.files[0]).toMatchObject({ state: 'done', found: 3 })
    const saved = await h.review.accept(batchId)
    const added = saved.ok && 'added' in saved ? saved.added : []
    const asset = h.assets.getAsset(added[0]!.id)!
    expect(asset.source).toMatchObject({ kind: 'extracted', styleId: 'sty_sci' })
    expect(asset.foundIn[0]).toMatchObject({ styleId: 'sty_sci', sourceId: 'src_01' })
  })

  it('adds more pictures to an open style batch without repeating the ones it has', async () => {
    const h = await harness()
    const found = await foundIn('A.pptx', await deckBytes([61, 62]))
    const { batchId } = await h.review.createReviewBatch({ source: style, candidates: found })
    await h.review.idle()
    await h.review.createReviewBatch({ source: style, candidates: found, batchId })
    await h.review.idle()
    expect(h.review.view().batches).toHaveLength(1)
    expect(h.review.view().found).toBe(3)
  })

  it('opens a "picked online" batch that keeps licences and credits', async () => {
    const h = await harness()
    const credit = {
      text: 'Picture credit: “Forest” by A. Photographer, CC BY-SA 4.0.',
      inNotes: true,
      provider: 'wikimedia' as const,
      author: 'A. Photographer',
      title: 'Forest',
      pageUrl: 'https://commons.wikimedia.org/wiki/File:Forest.jpg',
      licenceUrl: null
    }
    const { batchId } = await h.review.addOnlineBatch([
      newAssetInput('forest', {
        bytes: photoPng(70, 90, 70),
        licence: LICENCES['cc-by-sa'],
        credit,
        source: { kind: 'online', provider: 'wikimedia', at: '2026-10-07T09:00:00.000Z' }
      }),
      newAssetInput('forest', { bytes: photoPng(71, 90, 70) })
    ])
    const view = h.review.view()
    expect(view.batches[0]).toMatchObject({
      id: batchId,
      origin: { kind: 'online' },
      working: false
    })
    expect(view.candidates.map((c) => c.name)).toEqual(['forest', 'forest_2'])
    const saved = await h.review.accept(batchId)
    const added = saved.ok && 'added' in saved ? saved.added : []
    expect(h.assets.getAsset(added[0]!.id)).toMatchObject({
      licence: LICENCES['cc-by-sa'],
      credit,
      source: { kind: 'online', provider: 'wikimedia' }
    })
  })
})

describe('throwing a batch away', () => {
  it('removes its files and the banner, and is fine to repeat', async () => {
    const h = await harness()
    await upload(h)
    const { id } = h.review.view().batches[0]!
    expect(await h.review.dismiss(id)).toMatchObject({ ok: true })
    expect(h.review.view().found).toBe(0)
    expect(h.review.banner()).toBeNull()
    expect(await readdir(join(h.dir, 'assets', 'review'))).toEqual([])
    expect(await h.review.dismiss(id)).toMatchObject({ ok: true })
    expect(await h.review.accept(id)).toMatchObject({ ok: false, code: 'not-found' })
  })
})
