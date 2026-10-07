import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ok } from '@shared/result'
import { makeAnalysis } from '@shared/style/testing'
import { createHarness, type Harness } from './testing'
import { fakeExtract, fakePorts, logoOn, photoOn } from './picturesTesting'

let h: Harness
afterEach(() => h?.cleanup())

const LOGO_SHA = 'a'.repeat(64)
const KINDS = [
  { page: 1, kind: 'title' as const },
  { page: 2, kind: 'content' as const },
  { page: 3, kind: 'content' as const },
  { page: 4, kind: 'content' as const }
]

/** Two four-page decks that both carry the logo on every page, plus a photo on page 2 of the first. */
const decks = () => ({
  'a.pdf': {
    units: 4,
    images: [...logoOn('a.pdf', 4), photoOn('a.pdf', 2), photoOn('a.pdf', 3), photoOn('a.pdf', 4)]
  },
  'b.pdf': { units: 4, images: logoOn('b.pdf', 4) }
})

async function learn(names: string[]) {
  const { styleId } = await h.service.create()
  await h.service.addFiles(
    styleId,
    names.map((n) => h.pdf(n))
  )
  await h.service.whenIdle(styleId)
  return styleId
}

const view = async (id: string) => {
  const result = await h.service.get(id)
  if (!result.ok) throw new Error('missing style')
  return result.style
}

const factsOf = (styleId: string, sourceId: string) =>
  JSON.parse(readFileSync(join(h.dir, styleId, 'sources', `${sourceId}.pictures.json`), 'utf8'))

function harness(table = decks()) {
  const fakes = fakePorts()
  const extract = fakeExtract(table)
  h = createHarness({ extract, ports: () => fakes.ports })
  for (const name of Object.keys(table))
    h.stub.results.set(name, ok({ analysis: makeAnalysis({ slideKinds: KINDS }) }))
  return { ...fakes, extract }
}

describe('learning job: the picture step', () => {
  it('stores each file’s facts, sends the found pictures to review and shows the A6 numbers', async () => {
    const { review } = harness()
    const id = await learn(['a.pdf', 'b.pdf'])
    const style = await view(id)

    const sources = style.files.map((f) => f.id)
    expect(factsOf(id, sources[0])).toMatchObject({ schemaVersion: 1 })
    expect(factsOf(id, sources[0]).slides).toHaveLength(4)
    expect(
      factsOf(id, sources[0]).pictures.some((p: { slideKind: string }) => p.slideKind === 'content')
    ).toBe(true)

    expect(review.batches).toHaveLength(1)
    expect(review.batches[0]).toMatchObject({
      source: { kind: 'style', styleId: id, styleName: 'My style' },
      files: [
        { name: 'a.pdf', sourceId: sources[0] },
        { name: 'b.pdf', sourceId: sources[1] }
      ]
    })
    // the logo is ONE found picture, found in both decks; the three photos are three more
    expect(review.batches[0].candidates).toHaveLength(4)
    expect(style.profile?.assetsFound).toMatchObject({
      found: 4,
      suggested: 4,
      saved: 0,
      batchId: 'rvb_1'
    })
    expect(style.profile?.assetsFound?.preview).toHaveLength(4)
    expect(style.profile?.pictureHabits?.[0]).toMatch(
      /^A picture on the right of some content slides/
    )
    expect(style.progress.stage).toBe('done')
  })

  it('announces the stage "pictures" while it works', async () => {
    harness()
    const id = await learn(['a.pdf'])
    expect(h.progress().some((p) => p.progress.stage === 'pictures')).toBe(true)
    expect((await view(id)).progress.stage).toBe('done')
  })

  it('writes a placement line with the asset’s current name once she keeps the logo, and follows renames and deletes', async () => {
    const { library } = harness()
    const id = await learn(['a.pdf', 'b.pdf'])
    expect((await view(id)).profile?.pictureHabits?.some((l) => l.includes('{{'))).toBe(false)

    library.saved.set(LOGO_SHA, { id: 'ast_1', name: 'school_logo' })
    let style = await view(id)
    expect(style.profile?.pictureHabits).toContain(
      '{{school_logo}} in the top-right corner on every slide'
    )
    expect(style.profile?.assetsFound).toMatchObject({ saved: 1 })
    const profile = await h.service.getProfile(id)
    expect(profile?.pictures?.placements).toEqual([
      expect.objectContaining({
        assetId: 'ast_1',
        slideKind: 'every',
        anchor: 'top-right',
        decks: 2
      })
    ])

    library.saved.set(LOGO_SHA, { id: 'ast_1', name: 'stonebridge_logo' })
    style = await view(id)
    expect(style.profile?.pictureHabits?.at(-1)).toBe(
      '{{stonebridge_logo}} in the top-right corner on every slide'
    )

    library.saved.delete(LOGO_SHA)
    style = await view(id)
    expect(style.profile?.pictureHabits?.some((l) => l.includes('{{'))).toBe(false)
    expect((await h.service.getProfile(id))?.pictures?.placements).toEqual([])
  })

  it('one file whose pictures cannot be read never stops the others or the style', async () => {
    harness({ 'a.pdf': decks()['a.pdf'], 'b.pdf': undefined as never })
    const id = await learn(['a.pdf', 'b.pdf'])
    const style = await view(id)
    expect(style.files.map((f) => f.status)).toEqual(['learned', 'learned'])
    expect(style.progress.stage).toBe('done')
    const [a, b] = style.files.map((f) => f.id)
    expect(factsOf(id, a).pictures.length).toBeGreaterThan(0)
    expect(factsOf(id, b).pictures).toEqual([]) // no pictures, but its slides are still counted
    expect(factsOf(id, b).slides.length).toBeGreaterThan(0)
    expect(h.stub.synthCalls).toHaveLength(1)
    expect(style.profile?.assetsFound?.found).toBe(4)
  })

  it('carries on where it stopped: files that already have facts are not read again, and the batch is extended', async () => {
    const { extract, review } = harness()
    const { styleId } = await h.service.create()
    await h.service.addFiles(styleId, [h.pdf('a.pdf')])
    await h.service.whenIdle(styleId)
    expect(extract.calls).toEqual(['a.pdf'])

    await h.service.addFiles(styleId, [h.pdf('b.pdf')])
    await h.service.whenIdle(styleId)
    expect(extract.calls).toEqual(['a.pdf', 'b.pdf'])
    expect(review.batches[1].batchId).toBe('rvb_1') // the same open batch
    const style = await view(styleId)
    expect(style.profile?.assetsFound?.found).toBe(4) // the logo is counted once
  })

  it('shows "found 0" and no habits when her files hold no pictures', async () => {
    const { review } = harness({
      'a.pdf': { units: 4, images: [] },
      'b.pdf': { units: 4, images: [] }
    })
    const id = await learn(['a.pdf', 'b.pdf'])
    const style = await view(id)
    expect(review.batches).toEqual([])
    expect(style.profile?.assetsFound).toMatchObject({ found: 0, batchId: null, preview: [] })
    expect(style.profile?.pictureHabits).toEqual([])
    expect((await h.service.getProfile(id))?.pictures).toBeUndefined()
  })

  it('still learns the style and builds habits when the review queue is not running', async () => {
    const table = decks()
    h = createHarness({ extract: fakeExtract(table) })
    for (const name of Object.keys(table))
      h.stub.results.set(name, ok({ analysis: makeAnalysis({ slideKinds: KINDS }) }))
    const id = await learn(['a.pdf', 'b.pdf'])
    const style = await view(id)
    expect(style.profile?.assetsFound).toMatchObject({ found: 4, saved: 0, batchId: null })
    expect(style.profile?.pictureHabits?.length).toBeGreaterThan(0)
  })

  it('rebuilds the habits when a file is removed and when it is restored', async () => {
    harness()
    const id = await learn(['a.pdf', 'b.pdf'])
    const contentUse = async () =>
      (await h.service.getProfile(id))?.pictures?.slideKinds.find((k) => k.kind === 'content')
        ?.pictures
    expect(await contentUse()).toBe('sometimes') // photos on half of the content slides
    const [a] = (await view(id)).files
    await h.service.removeFile(id, a.id) // a.pdf held all the photos
    expect(await contentUse()).not.toBe('sometimes')
    await h.service.restoreFile(id, a.id)
    expect(await contentUse()).toBe('sometimes')
  })

  it('keeps old profiles without pictures valid: no picture fields in the view', async () => {
    h = createHarness()
    const id = await learn(['a.pdf'])
    const style = await view(id)
    expect(style.profile).not.toBeNull()
    expect(Array.isArray(style.profile?.pictureHabits)).toBe(true)
  })
})
