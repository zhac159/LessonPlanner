import { afterEach, describe, expect, it } from 'vitest'
import { extractAssets } from '../../../import/assets'
import { cleanTemp, deckBytes, harness, writeTemp } from './testing'

afterEach(cleanTemp)

/** An extraction service that cannot read the first file it is given, then works. */
function flaky(): typeof extractAssets {
  let calls = 0
  return (async (input, options) => {
    calls += 1
    if (calls === 1) throw new Error('boom')
    return extractAssets(input, options)
  }) as typeof extractAssets
}

describe('review:retry (Try again on a file that could not be read)', () => {
  it('reads the file again, with its pictures arriving as candidates', async () => {
    const h = await harness({ extract: flaky() })
    const path = await writeTemp(h.dir, 'good.pptx', await deckBytes([21]))
    await h.review.addPaths([path])
    await h.review.idle()
    const batch = h.review.view().batches[0]!
    expect(batch.files[0]).toMatchObject({ state: 'failed', error: 'This file could not be read.' })
    expect(h.review.view().found).toBe(0)

    expect(h.review.retryFile(batch.id, batch.files[0]!.id)).toMatchObject({ ok: true })
    // the row goes back to waiting at once, and is announced
    expect(h.review.view().batches[0]!.files[0]).toMatchObject({ state: 'waiting' })
    expect(h.review.view().batches[0]!.files[0]!.error).toBeUndefined()
    await h.review.idle()
    expect(h.review.view().batches[0]!.files[0]).toMatchObject({ state: 'done', found: 2 })
    expect(h.review.view().found).toBe(2)
    expect(h.review.view().batches[0]).toMatchObject({ working: false })
  })

  it('only retries the file it was asked about and leaves the others alone', async () => {
    const h = await harness({ extract: flaky() })
    const bad = await writeTemp(h.dir, 'first.pptx', await deckBytes([21]))
    const good = await writeTemp(h.dir, 'second.pptx', await deckBytes([22]))
    await h.review.addPaths([bad, good])
    await h.review.idle()
    const batch = h.review.view().batches[0]!
    expect(batch.files.map((f) => f.state)).toEqual(['failed', 'done'])
    const foundBefore = h.review.view().found
    h.review.retryFile(batch.id, batch.files[0]!.id)
    await h.review.idle()
    const after = h.review.view().batches[0]!
    expect(after.files.map((f) => f.state)).toEqual(['done', 'done'])
    expect(h.review.view().found).toBeGreaterThan(foundBefore)
  })

  it('says why it cannot when the file is fine, unknown or gone', async () => {
    const h = await harness()
    const path = await writeTemp(h.dir, 'good.pptx', await deckBytes([21]))
    await h.review.addPaths([path])
    await h.review.idle()
    const batch = h.review.view().batches[0]!
    const file = batch.files[0]!
    expect(h.review.retryFile(batch.id, file.id)).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
    expect(h.review.retryFile(batch.id, 'nope')).toMatchObject({ ok: false, code: 'not-found' })
    expect(h.review.retryFile('nope', file.id)).toMatchObject({ ok: false, code: 'not-found' })
  })

  it('asks her to add the file again after a restart (the app did not keep it)', async () => {
    const h = await harness({ extract: flaky() })
    const path = await writeTemp(h.dir, 'good.pptx', await deckBytes([21]))
    await h.review.addPaths([path])
    await h.review.idle()
    const reopened = h.make()
    await reopened.init()
    const batch = reopened.view().batches[0]!
    expect(reopened.retryFile(batch.id, batch.files[0]!.id)).toMatchObject({
      ok: false,
      code: 'not-found',
      message: 'I no longer have that file. Add it again.'
    })
  })

  it('does not retry twice: the second call finds it already being read', async () => {
    const h = await harness({ extract: flaky() })
    const path = await writeTemp(h.dir, 'good.pptx', await deckBytes([21]))
    await h.review.addPaths([path])
    await h.review.idle()
    const batch = h.review.view().batches[0]!
    const id = batch.files[0]!.id
    expect(h.review.retryFile(batch.id, id).ok).toBe(true)
    expect(h.review.retryFile(batch.id, id)).toMatchObject({ ok: false, code: 'invalid-input' })
    await h.review.idle()
  })
})
