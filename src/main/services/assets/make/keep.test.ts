import { afterEach, describe, expect, it } from 'vitest'
import { AssetsService } from '../service'
import { cleanTemp, harness } from './testing'
import { createMakeApi, getSharedMake, type MakeAssetsPort } from './index'
import { createFakeMaker } from './fakeMaker'

afterEach(cleanTemp)

const START = {
  basedOn: [] as string[],
  prompt: 'A Bunsen burner with a lit flame.',
  versions: 2 as 2 | 4
}

async function made(h: Awaited<ReturnType<typeof harness>>, basedOn: string[] = []) {
  const started = await h.service.start({ ...START, basedOn })
  if (!started.ok) throw new Error('start failed')
  await h.finished(started.jobId)
  return started.jobId
}

describe('keeping a version', () => {
  it('saves it as a generated asset with licence, credit and what it was based on', async () => {
    const h = await harness()
    const icon = await h.addAsset('flask_icon', 'icon')
    const before = h.assets.store.size
    const jobId = await made(h, [icon.id])
    const kept = await h.service.keepVersion({ jobId, version: 2, name: 'bunsen_burner_icon' })
    if (!kept.ok) throw new Error(kept.message)
    const { asset } = kept
    expect(h.assets.store.size).toBe(before + 1)
    expect(asset.name).toBe('bunsen_burner_icon')
    expect(asset.kind).toBe('icon')
    expect(asset.source).toEqual({
      kind: 'generated',
      model: 'gemini-3-pro-image',
      prompt: START.prompt,
      basedOn: [icon.id],
      at: '2026-10-07T10:00:00.000Z'
    })
    expect(asset.licence.label).toBe('Made for you')
    expect(asset.credit).toMatchObject({
      text: 'Picture made with Nano Banana Pro (AI-generated).',
      inNotes: true
    })
    expect(asset.description).toContain('Made in the style of flask_icon.')
    expect(asset.file.ext).toBe('.png')
  })

  it('credits Claude for vector drawings and saves an SVG', async () => {
    const h = await harness({ googleKey: false })
    const jobId = await made(h)
    const kept = await h.service.keepVersion({ jobId, version: 1, name: 'burner', kind: 'diagram' })
    if (!kept.ok) throw new Error(kept.message)
    expect(kept.asset.credit?.text).toBe('Picture drawn by Claude.')
    expect(kept.asset.source).toMatchObject({ kind: 'generated', model: 'claude-svg' })
    expect(kept.asset.kind).toBe('diagram')
    expect(kept.asset.file.vector).toBe(true)
  })

  it('refuses a taken or invalid name and keeps the job so she can fix it', async () => {
    const h = await harness()
    const icon = await h.addAsset('flask_icon', 'icon')
    const jobId = await made(h)
    expect(await h.service.keepVersion({ jobId, version: 1, name: icon.name })).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
    expect(await h.service.keepVersion({ jobId, version: 1, name: 'ok_name' })).toMatchObject({
      ok: true
    })
  })

  it('refuses a version that does not exist or did not arrive, and keeps nothing twice', async () => {
    const h = await harness()
    const jobId = await made(h)
    expect(await h.service.keepVersion({ jobId, version: 9, name: 'burner' })).toMatchObject({
      code: 'not-found'
    })
    expect(
      await h.service.keepVersion({ jobId: 'nope', version: 1, name: 'burner' })
    ).toMatchObject({ code: 'not-found' })
    expect((await h.service.keepVersion({ jobId, version: 1, name: 'burner' })).ok).toBe(true)
    expect(await h.service.keepVersion({ jobId, version: 1, name: 'burner_two' })).toMatchObject({
      code: 'not-found'
    })
  })

  it('tells the describe cache about the new picture (no extra Claude call)', async () => {
    const h = await harness()
    const set: Array<{ sha: string; description: string }> = []
    const service = new (h.service.constructor as typeof import('./service').MakeService)({
      ...h.deps,
      describeCache: { set: (sha, facts) => void set.push({ sha, description: facts.description }) }
    })
    const started = await service.start(START)
    if (!started.ok) throw new Error('start failed')
    await h.finished(started.jobId)
    const kept = await service.keepVersion({ jobId: started.jobId, version: 1, name: 'burner' })
    if (!kept.ok) throw new Error(kept.message)
    expect(set).toEqual([{ sha: kept.asset.file.sha256, description: kept.asset.description }])
  })
})

describe('createMakeApi', () => {
  it('serves the four make:* methods, returns a summary on keep and registers the shared service', async () => {
    const h = await harness()
    const api = createMakeApi({
      ...h.deps,
      createMaker: () => createFakeMaker('gemini-3-pro-image')
    })
    expect(Object.keys(api).sort()).toEqual([
      'make:cancel',
      'make:keep',
      'make:mode',
      'make:retry',
      'make:start'
    ])
    expect(getSharedMake()).not.toBeNull()
    expect(await api['make:mode']()).toMatchObject({ mode: 'picture-maker' })
    const started = await api['make:start']({ ...START, prompt: 'A burner' })
    if (!started.ok) throw new Error('start failed')
    await h.finished(started.jobId)
    const kept = await api['make:keep']({ jobId: started.jobId, version: 1, name: 'burner' })
    expect(kept).toMatchObject({ ok: true, asset: { name: 'burner', sourceKind: 'generated' } })
    await api['make:cancel']({ jobId: started.jobId })
  })

  it('accepts the real AssetsService as its library port', async () => {
    const h = await harness()
    const port: MakeAssetsPort = h.assets satisfies AssetsService
    expect(port.tools).toBe(h.assets.tools)
  })
})
