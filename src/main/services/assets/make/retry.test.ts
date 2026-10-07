import { afterEach, describe, expect, it } from 'vitest'
import { fail } from '@shared/result'
import { NOT_FAILED, STILL_DRAWING } from './copy'
import { cleanTemp, fakeMaker, harness } from './testing'

afterEach(cleanTemp)

const START = { basedOn: [] as string[], prompt: 'A Bunsen burner', versions: 4 as 2 | 4 }
const NETWORK = fail('network', 'Could not reach Google.')

describe('make:retry (Try again on one failed version)', () => {
  it('draws only that version again, and the rest stay as they were', async () => {
    const maker = fakeMaker({ answer: (i) => (i === 1 ? NETWORK : undefined) })
    const h = await harness({ maker })
    const started = await h.service.start(START)
    if (!started.ok) throw new Error('start failed')
    const first = await h.finished(started.jobId)
    const failedIndex = first.versions.findIndex((v) => v.state === 'failed')
    expect(failedIndex).toBeGreaterThanOrEqual(0)
    const thumbsBefore = first.versions.map((v) => v.thumbDataUrl)
    const requestsBefore = maker.requests.length
    const costsBefore = h.costs.length

    const retried = await h.service.retryVersion({ jobId: started.jobId, version: failedIndex + 1 })
    expect(retried).toMatchObject({ ok: true })
    expect(maker.requests.length).toBe(requestsBefore + 1)
    expect(h.costs.length).toBe(costsBefore + 1)
    const last = h.events.at(-1)!
    expect(last.stage).toBe('done')
    expect(last.versions.every((v) => v.state === 'ready')).toBe(true)
    last.versions.forEach((v, i) => {
      if (i !== failedIndex) expect(v.thumbDataUrl).toBe(thumbsBefore[i])
    })
    // the sheet saw the tile go back to waiting first
    const during = h.events.filter((e) => e.stage === 'drawing').at(-1)!
    expect(during.versions[failedIndex]!.state).toBe('waiting')
    // and the new picture can be kept
    const kept = await h.service.keepVersion({
      jobId: started.jobId,
      version: failedIndex + 1,
      name: 'burner_retry'
    })
    expect(kept.ok).toBe(true)
  })

  it('says why when it fails again, and keeps the tile failed', async () => {
    const maker = fakeMaker({ answer: (i) => (i === 0 || i === 2 ? NETWORK : undefined) })
    const h = await harness({ maker })
    const started = await h.service.start({ ...START, versions: 2 })
    if (!started.ok) throw new Error('start failed')
    const first = await h.finished(started.jobId)
    const failedIndex = first.versions.findIndex((v) => v.state === 'failed')
    expect(failedIndex).toBeGreaterThanOrEqual(0)
    const again = await h.service.retryVersion({ jobId: started.jobId, version: failedIndex + 1 })
    expect(again).toMatchObject({ ok: false, code: 'network', message: 'Could not reach Google.' })
    expect(h.events.at(-1)!.versions[failedIndex]!.state).toBe('failed')
  })

  it('refuses a version that worked, one that does not exist and a job that is gone', async () => {
    const maker = fakeMaker({ answer: (i) => (i === 1 ? NETWORK : undefined) })
    const h = await harness({ maker })
    const started = await h.service.start(START)
    if (!started.ok) throw new Error('start failed')
    const first = await h.finished(started.jobId)
    const readyIndex = first.versions.findIndex((v) => v.state === 'ready')
    expect(
      await h.service.retryVersion({ jobId: started.jobId, version: readyIndex + 1 })
    ).toMatchObject({ ok: false, code: 'invalid-input', message: NOT_FAILED })
    expect(await h.service.retryVersion({ jobId: started.jobId, version: 9 })).toMatchObject({
      ok: false,
      code: 'not-found'
    })
    expect(await h.service.retryVersion({ jobId: 'nope', version: 1 })).toMatchObject({
      ok: false,
      code: 'not-found'
    })
  })

  it('does not start while the job is still drawing', async () => {
    let open: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (open = resolve))
    const h = await harness({ maker: fakeMaker({ gate: () => gate }) })
    const started = await h.service.start({ ...START, versions: 2 })
    if (!started.ok) throw new Error('start failed')
    await h.until((p) => p.jobId === started.jobId && p.stage === 'drawing')
    expect(await h.service.retryVersion({ jobId: started.jobId, version: 1 })).toMatchObject({
      ok: false,
      code: 'refused',
      message: STILL_DRAWING
    })
    open()
    await h.finished(started.jobId)
  })

  it('works in vector mode too: asks Claude for one drawing', async () => {
    const h = await harness({ googleKey: false })
    h.ai.drawSvg.mockImplementationOnce(async () => fail('network', 'Claude is busy.') as never)
    const started = await h.service.start({ ...START, versions: 2 })
    if (!started.ok) throw new Error('start failed')
    const first = await h.finished(started.jobId)
    expect(first.stage).toBe('error')
    expect(first.versions.map((v) => v.state)).toEqual(['failed', 'failed'])
    expect(await h.service.retryVersion({ jobId: started.jobId, version: 2 })).toMatchObject({
      ok: true
    })
    expect(h.ai.drawSvg).toHaveBeenLastCalledWith(
      expect.objectContaining({ versions: 1 }),
      expect.anything()
    )
    const last = h.events.at(-1)!
    expect(last.versions.map((v) => v.state)).toEqual(['failed', 'ready'])
    expect(last.stage).toBe('done')
  })

  it('is served as make:retry and checks what arrives', async () => {
    const maker = fakeMaker({ answer: (i) => (i === 0 ? NETWORK : undefined) })
    const h = await harness({ maker })
    const api = h.service.api()
    const started = await h.service.start({ ...START, versions: 2 })
    if (!started.ok) throw new Error('start failed')
    const first = await h.finished(started.jobId)
    const failedIndex = first.versions.findIndex((v) => v.state === 'failed')
    expect(
      await api['make:retry']({ jobId: started.jobId, version: failedIndex + 1 })
    ).toMatchObject({ ok: true })
    expect(await api['make:retry'](undefined as never)).toMatchObject({ ok: false })
  })
})
