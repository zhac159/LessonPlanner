import { afterEach, describe, expect, it } from 'vitest'
import { fail } from '@shared/result'
import { cleanTemp, fakeMaker, harness } from './testing'
import { NEED_A_REQUEST, NOTHING_CONNECTED, PHOTO_NEEDS_MAKER } from './copy'

afterEach(cleanTemp)

const START = {
  basedOn: [] as string[],
  prompt: 'A Bunsen burner with a lit flame',
  versions: 4 as 2 | 4
}

describe('make mode', () => {
  it('uses the picture maker when a key is saved and says what it costs', async () => {
    const h = await harness()
    expect(await h.service.mode()).toEqual({
      mode: 'picture-maker',
      modelLabel: 'Nano Banana Pro',
      perPictureUsd: 0.134
    })
  })

  it('knows the cheaper model', async () => {
    const h = await harness({ model: 'gemini-nano-banana-2.1' })
    expect(await h.service.mode()).toMatchObject({
      modelLabel: 'Nano Banana 2.1',
      perPictureUsd: 0.0504
    })
  })

  it('falls back to vector drawing without a key or when the last test rejected the key', async () => {
    expect((await (await harness({ googleKey: false })).service.mode()).mode).toBe('vector')
    expect((await (await harness({ lastTest: 'invalid-key' })).service.mode()).mode).toBe('vector')
    const vector = await (await harness({ googleKey: false })).service.mode()
    expect(vector).toMatchObject({ modelLabel: null, perPictureUsd: null })
  })

  it('keeps the picture maker when the last test only failed on the network', async () => {
    expect((await (await harness({ lastTest: 'network' })).service.mode()).mode).toBe(
      'picture-maker'
    )
  })

  it('is unavailable with neither key', async () => {
    const h = await harness({ googleKey: false, claudeKey: false })
    expect((await h.service.mode()).mode).toBe('unavailable')
    expect(await h.service.start(START)).toMatchObject({ ok: false, message: NOTHING_CONNECTED })
  })
})

describe('make:start checks', () => {
  it('needs words and a version count of 2 or 4', async () => {
    const h = await harness()
    expect(await h.service.start({ ...START, prompt: '   ' })).toMatchObject({
      ok: false,
      code: 'invalid-input',
      message: NEED_A_REQUEST
    })
    expect(await h.service.start({ ...START, versions: 3 })).toMatchObject({ ok: false })
    expect(await h.service.start(null)).toMatchObject({ ok: false })
  })

  it('refuses photo-like requests in vector mode with the friendly message', async () => {
    const h = await harness({ googleKey: false })
    const asked = await h.service.start({ ...START, prompt: 'A photo of a leaf' })
    expect(asked).toMatchObject({ ok: false, message: PHOTO_NEEDS_MAKER })
    const kind = await h.service.start({ ...START, kind: 'photo' })
    expect(kind).toMatchObject({ ok: false, message: PHOTO_NEEDS_MAKER })
    expect(h.ai.drawSvg).not.toHaveBeenCalled()
  })
})

describe('making versions with the picture maker', () => {
  it('makes four versions, two at a time, and reports each as it arrives', async () => {
    const maker = fakeMaker({ gate: () => Promise.resolve() })
    const h = await harness({ maker })
    const started = await h.service.start(START)
    if (!started.ok) throw new Error('start failed')
    const last = await h.finished(started.jobId)
    expect(last.stage).toBe('done')
    expect(last.versions.map((v) => v.state)).toEqual(['ready', 'ready', 'ready', 'ready'])
    expect(last.versions.every((v) => v.thumbDataUrl?.startsWith('data:image/png'))).toBe(true)
    expect(maker.requests).toHaveLength(4)
    expect(maker.maxInFlight()).toBe(2)
    expect(h.events[0]!.stage).toBe('describing')
    expect(h.events.filter((e) => e.stage === 'drawing').length).toBeGreaterThanOrEqual(4)
    expect(h.costs).toHaveLength(4)
    expect(h.costs[0]).toEqual({ model: 'gemini-3-pro-image', usd: 0.134, count: 1 })
  })

  it('asks for two versions when she chose two', async () => {
    const h = await harness()
    const started = await h.service.start({ ...START, versions: 2 })
    if (!started.ok) throw new Error('start failed')
    const last = await h.finished(started.jobId)
    expect(last.versions).toHaveLength(2)
  })

  it('composes the prompt from her words, the style description and the kind', async () => {
    const h = await harness()
    const icon = await h.addAsset('flask_icon', 'icon')
    const started = await h.service.start({ ...START, basedOn: [icon.id], versions: 2 })
    if (!started.ok) throw new Error('start failed')
    const last = await h.finished(started.jobId)
    expect(last.styleDescription).toBe('Flat navy outlines, teal fills.')
    const request = h.maker.requests[0]!
    expect(request.prompt).toContain('A Bunsen burner with a lit flame')
    expect(request.prompt).toContain('Match this style exactly: Flat navy outlines, teal fills.')
    expect(request.prompt).toContain('simple icon')
    expect(request.prompt).toContain('attached pictures')
    expect(request.aspect).toBe('1:1')
    expect(request.size).toBe('2K')
    expect(request.count).toBe(1)
  })

  it('sends only drawn pictures as references, never photos (owner decision)', async () => {
    const h = await harness()
    const icon = await h.addAsset('flask_icon', 'icon', 1)
    const diagram = await h.addAsset('water_cycle', 'diagram', 2)
    const photo = await h.addAsset('class_photo', 'photo', 3)
    const picture = await h.addAsset('some_scene', 'picture', 4)
    const started = await h.service.start({
      ...START,
      versions: 2,
      basedOn: [icon.id, diagram.id, photo.id, picture.id]
    })
    if (!started.ok) throw new Error('start failed')
    await h.finished(started.jobId)
    expect(h.maker.requests[0]!.references).toHaveLength(2)
    // Claude still sees every picked picture's thumbnail for the style description.
    const described = h.ai.describeStyleOfAssets.mock.calls[0]![0] as unknown as {
      images: unknown[]
      kinds: string[]
    }
    expect(described.kinds).toEqual(['icon', 'diagram', 'photo', 'picture'])
  })

  it('sends no references when only photos were picked', async () => {
    const h = await harness()
    const photo = await h.addAsset('class_photo', 'photo', 3)
    const started = await h.service.start({ ...START, versions: 2, basedOn: [photo.id] })
    if (!started.ok) throw new Error('start failed')
    await h.finished(started.jobId)
    expect(h.maker.requests[0]!.references).toEqual([])
  })

  it('shows a failed version and still delivers the rest', async () => {
    const maker = fakeMaker({
      answer: (i) => (i === 1 ? fail('network', 'Could not reach Google.') : undefined)
    })
    const h = await harness({ maker })
    const started = await h.service.start(START)
    if (!started.ok) throw new Error('start failed')
    const last = await h.finished(started.jobId)
    expect(last.stage).toBe('done')
    expect(last.versions.map((v) => v.state)).toEqual(['ready', 'failed', 'ready', 'ready'])
    expect(last.error).toMatchObject({ code: 'network', retryable: true })
  })

  it('stops at the first failure that cannot improve (no billing) and says why', async () => {
    const maker = fakeMaker({
      answer: () => fail('no-credit', 'The Google account has no billing set up or no credit left.')
    })
    const h = await harness({ maker })
    const started = await h.service.start(START)
    if (!started.ok) throw new Error('start failed')
    const last = await h.finished(started.jobId)
    expect(last.stage).toBe('error')
    expect(last.versions.every((v) => v.state === 'failed')).toBe(true)
    expect(last.error).toMatchObject({ code: 'no-credit', retryable: false })
    expect(maker.requests.length).toBeLessThanOrEqual(2)
  })

  it('passes a bad key and a safety block on with their friendly messages', async () => {
    const bad = await harness({
      maker: fakeMaker({ answer: () => fail('invalid-key', 'Google did not accept this key.') })
    })
    const a = await bad.service.start({ ...START, versions: 2 })
    if (!a.ok) throw new Error('start failed')
    expect((await bad.finished(a.jobId)).error?.code).toBe('invalid-key')

    const blocked = await harness({
      maker: fakeMaker({
        answer: () => fail('refused', "Google's safety filter would not make that.")
      })
    })
    const b = await blocked.service.start({ ...START, versions: 2 })
    if (!b.ok) throw new Error('start failed')
    const last = await blocked.finished(b.jobId)
    expect(last.error).toMatchObject({ code: 'refused', retryable: true })
    expect(blocked.maker.requests).toHaveLength(2)
  })

  it('never puts a Google key into an error message', async () => {
    const h = await harness({
      maker: fakeMaker({
        answer: () => fail('unknown', 'Failed with AIzaSyA1234567890abcdefghijklmnopqrstuv.')
      })
    })
    const started = await h.service.start({ ...START, versions: 2 })
    if (!started.ok) throw new Error('start failed')
    expect((await h.finished(started.jobId)).error?.message).not.toContain('AIzaSyA1234')
  })

  it('stops before any billing when the style cannot be described and there are no references', async () => {
    const h = await harness({ describe: () => fail('no-key', 'Connect Claude first.') })
    const photo = await h.addAsset('class_photo', 'photo', 3)
    const started = await h.service.start({ ...START, basedOn: [photo.id] })
    if (!started.ok) throw new Error('start failed')
    const last = await h.finished(started.jobId)
    expect(last.stage).toBe('error')
    expect(h.maker.requests).toHaveLength(0)
  })

  it('carries on with references when only the description failed', async () => {
    const h = await harness({ describe: () => fail('overloaded', 'Busy.') })
    const icon = await h.addAsset('flask_icon', 'icon')
    const started = await h.service.start({ ...START, versions: 2, basedOn: [icon.id] })
    if (!started.ok) throw new Error('start failed')
    expect((await h.finished(started.jobId)).stage).toBe('done')
  })

  it('does not report anything after cancel and forgets the job', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((r) => (release = r))
    const h = await harness({ maker: fakeMaker({ gate: () => gate }) })
    const started = await h.service.start(START)
    if (!started.ok) throw new Error('start failed')
    await h.until((p) => p.stage === 'drawing')
    h.service.cancel(started.jobId)
    const seen = h.events.length
    release()
    await h.maker.idle()
    expect(h.events).toHaveLength(seen)
    expect(
      await h.service.keepVersion({ jobId: started.jobId, version: 1, name: 'burner' })
    ).toMatchObject({
      ok: false,
      code: 'not-found'
    })
  })
})

describe('vector mode', () => {
  it('asks Claude to draw every version in one call', async () => {
    const h = await harness({ googleKey: false })
    const icon = await h.addAsset('flask_icon', 'icon')
    const started = await h.service.start({ ...START, versions: 2, basedOn: [icon.id] })
    if (!started.ok) throw new Error('start failed')
    const last = await h.finished(started.jobId)
    expect(last.stage).toBe('done')
    expect(last.versions.map((v) => v.state)).toEqual(['ready', 'ready'])
    expect(h.ai.drawSvg).toHaveBeenCalledTimes(1)
    expect(h.ai.drawSvg.mock.calls[0]![0]).toMatchObject({
      prompt: START.prompt,
      kind: 'icon',
      versions: 2,
      styleDescription: 'Flat navy outlines, teal fills.'
    })
    expect(h.maker.requests).toHaveLength(0)
  })

  it('reports Claude failing as the job error', async () => {
    const h = await harness({ googleKey: false })
    h.ai.drawSvg.mockResolvedValueOnce(
      fail('invalid-key', 'Claude did not accept the key.') as never
    )
    const started = await h.service.start(START)
    if (!started.ok) throw new Error('start failed')
    const last = await h.finished(started.jobId)
    expect(last).toMatchObject({ stage: 'error', error: { code: 'invalid-key' } })
  })
})
