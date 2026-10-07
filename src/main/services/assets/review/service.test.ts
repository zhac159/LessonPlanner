import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { fail } from '@shared/result'
import { createFakeAiService } from '../../../ai/fake'
import { photoPng } from '../testing'
import { cleanTemp, deckBytes, foundIn, harness, upload, writeTemp } from './testing'

afterEach(cleanTemp)

describe('adding a PowerPoint', () => {
  it('cuts out the pictures, names them and keeps the logo as one picture', async () => {
    const h = await harness()
    const result = await upload(h)
    expect(result).toMatchObject({ ok: true, accepted: 1, rejected: [] })
    const view = h.review.view()
    expect(view.found).toBe(3)
    expect(view.keeping).toBe(3)
    expect(view.stillReading).toBe(0)
    expect(view.batches[0]).toMatchObject({ origin: { kind: 'upload' }, working: false })
    expect(view.batches[0]?.files[0]).toMatchObject({
      name: 'Y8 Cells.pptx',
      state: 'done',
      found: 3
    })
    const logo = view.candidates.find((c) => c.kind === 'logo')
    expect(logo).toMatchObject({ keep: true, leftOut: null, decks: 1 })
    expect(logo?.description).not.toBe('')
    expect(view.candidates.every((c) => c.thumbDataUrl?.startsWith('data:image/png'))).toBe(true)
    expect(new Set(view.candidates.map((c) => c.name)).size).toBe(3)
    // the screen is told while it works, and the last event is the final state
    expect(h.events.length).toBeGreaterThan(2)
    expect(h.events.at(-1)).toEqual(view)
  })

  it('keeps a bad file from stopping the others', async () => {
    const h = await harness()
    const good = await writeTemp(h.dir, 'good.pptx', await deckBytes([21]))
    const bad = await writeTemp(h.dir, 'bad.pdf', '%PDF-1.4 this is not a pdf')
    const result = await h.review.addPaths([bad, good])
    await h.review.idle()
    expect(result).toMatchObject({ ok: true, accepted: 2 })
    const files = h.review.view().batches[0]!.files
    expect(files.map((f) => f.state)).toEqual(['failed', 'done'])
    expect(files[0]?.error).toBeTruthy()
    expect(h.review.view().found).toBe(2)
  })

  it('says so when a PDF is only scanned pages', async () => {
    const scanned = async () => ({
      fileName: 'scan.pdf',
      sourceKind: 'pdf' as const,
      units: 3,
      images: [],
      scanned: true,
      warnings: []
    })
    const h = await harness({ extract: scanned })
    const path = await writeTemp(h.dir, 'scan.pdf', '%PDF-1.4')
    await h.review.addPaths([path])
    await h.review.idle()
    expect(h.review.view().batches[0]?.files[0]).toMatchObject({
      state: 'failed',
      error: "This PDF is only scanned pages, so there's nothing to cut out."
    })
  })

  it('turns away what it cannot read and says why', async () => {
    const h = await harness()
    const notes = await writeTemp(h.dir, 'notes.txt', 'hello')
    const empty = await writeTemp(h.dir, 'empty.png', new Uint8Array())
    const fake = await writeTemp(h.dir, 'fake.png', 'not really a picture')
    const result = await h.review.addPaths([notes, empty, fake, join(h.dir, 'gone.png')])
    expect(result).toEqual({
      ok: true,
      batchId: '',
      accepted: 0,
      rejected: [
        { name: 'notes.txt', reason: 'type' },
        { name: 'empty.png', reason: 'empty' },
        { name: 'fake.png', reason: 'corrupt' },
        { name: 'gone.png', reason: 'corrupt' }
      ]
    })
    expect(h.review.view().batches).toEqual([])
  })

  it('describes a single uploaded picture straight away', async () => {
    const h = await harness()
    const path = await writeTemp(h.dir, 'Beaker Icon.png', photoPng(5, 90, 70))
    const result = await h.review.addPaths([path])
    await h.review.idle()
    expect(result).toMatchObject({ ok: true, accepted: 1 })
    const [c] = h.review.view().candidates
    expect(c).toMatchObject({ keep: true, decks: 0, leftOut: null })
    expect(c?.description).not.toBe('')
    expect(h.calls).toEqual([1])
  })
})

describe('naming', () => {
  it('sends at most 12 pictures to Claude at a time', async () => {
    const h = await harness()
    await upload(h, await deckBytes(Array.from({ length: 13 }, (_, i) => 30 + i)))
    expect(h.calls).toEqual([12, 2])
    expect(h.review.view().found).toBe(14)
  })

  it('describes a picture once, ever (the cache is a file)', async () => {
    const h = await harness()
    const path = await writeTemp(h.dir, 'owl.png', photoPng(8, 90, 70))
    const first = await h.review.addPaths([path])
    await h.review.idle()
    if (first.ok) await h.review.dismiss(first.batchId)
    const later = h.make()
    await later.addPaths([path])
    await later.idle()
    expect(h.calls).toEqual([1])
    expect(later.view().candidates[0]?.description).not.toBe('')
  })

  it('keeps the extractor names when Claude is unreachable and names them on the second try', async () => {
    let down = true
    const base = createFakeAiService()
    const h = await harness({
      ai: {
        describeAssets: (input, opts) =>
          down ? Promise.resolve(fail('unknown', 'offline')) : base.describeAssets(input, opts)
      }
    })
    await upload(h)
    const before = h.review.view()
    expect(before.found).toBe(3)
    expect(before.candidates.every((c) => c.description === '')).toBe(true)
    expect(before.batches[0]?.files[0]?.state).toBe('done')
    down = false
    expect(h.review.nameWithClaude(before.batches[0]!.id)).toMatchObject({ ok: true })
    await h.review.idle()
    expect(h.review.view().candidates.every((c) => c.description !== '')).toBe(true)
  })

  it('never sends a picture that may show pupils, and never ticks it', async () => {
    const h = await harness()
    const found = await foundIn('Y8 Cells.pptx', await deckBytes([41, 42]))
    const photo = found.find((f) => f.kind !== 'logo')!
    photo.needsReview = true
    photo.leftOut = 'pupils'
    photo.keep = false
    await h.review.createReviewBatch({ source: { kind: 'upload' }, candidates: found })
    await h.review.idle()
    expect(h.calls).toEqual([found.length - 1])
    const flagged = h.review.view().candidates.find((c) => c.leftOut?.reason === 'pupils')
    expect(flagged).toMatchObject({ keep: false, description: '' })
  })

  it('lets Claude flag people in a picture and leaves those unticked', async () => {
    const base = createFakeAiService()
    const h = await harness({
      ai: {
        describeAssets: async (input, opts) => {
          const answer = await base.describeAssets(input, opts)
          return answer.ok
            ? {
                ...answer,
                described: answer.described.map((d, i) => ({ ...d, maybePupils: i === 0 }))
              }
            : answer
        }
      }
    })
    await upload(h)
    const reasons = h.review.view().candidates.map((c) => c.leftOut?.reason ?? null)
    expect(reasons.filter((r) => r === 'pupils')).toHaveLength(1)
    expect(h.review.view().keeping).toBe(2)
  })
})
