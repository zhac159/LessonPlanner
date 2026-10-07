import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { harness, cleanTemp, type Harness } from '../services/assets/review/testing'
import { writeSeedReview } from './seedReview'

// Writing the seeded batch is some hundred small file operations, and loading it reads them all again: milliseconds when
// the machine is quiet, tens of seconds when it is starved. So it is done once, here, and every test only reads it.
const SEEDING_TIMEOUT = 60_000

describe('the seeded review batch', { timeout: SEEDING_TIMEOUT }, () => {
  let h: Harness
  beforeAll(async () => {
    h = await harness()
    await writeSeedReview(join(h.dir, 'assets'), new Date('2026-10-07T09:00:00Z'))
    // loads like a batch that survived a restart
    await h.review.init()
  }, SEEDING_TIMEOUT)
  afterAll(cleanTemp)

  it('counts found 12, keeping 9, three left out, and fills the A1 banner', () => {
    expect(h.review.view()).toMatchObject({ found: 12, keeping: 9, leftOut: 3, stillReading: 0 })
    expect(h.review.banner()).toMatchObject({ found: 12, styleName: 'Science KS3' })
  })

  it('gives each picture that starts unticked its reason', () => {
    const reasons = Object.fromEntries(
      h.review
        .view()
        .candidates.filter((c) => c.leftOut)
        .map((c) => [c.name, c.leftOut])
    )
    expect(reasons).toEqual({
      class_photo: { reason: 'pupils' },
      school_logo_old: { reason: 'older-version', ofName: 'school_logo' },
      hills_photo: { reason: 'blurry' }
    })
  })

  it('starts with the school logo, found in 24 decks, and every picture has a thumbnail', () => {
    const { candidates } = h.review.view()
    expect(candidates[0]).toMatchObject({ name: 'school_logo', decks: 24 })
    expect(candidates.every((c) => c.thumbDataUrl?.startsWith('data:image/png'))).toBe(true)
  })
})
