import { afterEach, describe, expect, it } from 'vitest'
import { createNanoBananaMaker } from '../../imageProviders/nanoBanana'
import { fakeFetch, json } from '../../imageProviders/testing'
import { cleanTemp, harness } from './testing'

afterEach(cleanTemp)

/** Recorded 2026-10-07 from the real service: a Google key on a project without billing (trimmed). */
const FREE_TIER_BODY = {
  error: {
    code: 429,
    message:
      'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-nano-banana-2.1\nPlease retry in 14h54m5.206656368s.',
    status: 'RESOURCE_EXHAUSTED'
  }
}

describe('Google answers through the real maker', () => {
  it('turns a free-tier 429 into the no-billing message and stops after the first round', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(FREE_TIER_BODY, 429))
    const h = await harness({
      maker: createNanoBananaMaker({
        getKey: async () => 'AIza-test',
        fetchFn,
        model: 'gemini-nano-banana-2.1'
      })
    })
    const started = await h.service.start({ basedOn: [], prompt: 'A burner', versions: 4 })
    if (!started.ok) throw new Error('start failed')
    const last = await h.finished(started.jobId)
    expect(last.stage).toBe('error')
    expect(last.error).toMatchObject({ code: 'no-credit', retryable: false })
    expect(last.error?.message).toMatch(/billing/i)
    expect(last.versions.every((v) => v.state === 'failed')).toBe(true)
    // Both workers were already in flight; nothing more is asked once Google said no.
    expect(calls).toHaveLength(2)
    expect(calls[0]!.headers['x-goog-api-key']).toBe('AIza-test')
    expect(calls[0]!.url).not.toContain('AIza')
  })

  it('shows a stopping failure rather than an earlier one-off', async () => {
    const answers = [
      () => json({ error: { code: 503, message: 'busy', status: 'UNAVAILABLE' } }, 503),
      () => json(FREE_TIER_BODY, 429)
    ]
    const { fetchFn } = fakeFetch((_call, i) => answers[Math.min(i, 1)]!())
    const h = await harness({
      maker: createNanoBananaMaker({
        getKey: async () => 'k',
        fetchFn,
        model: 'gemini-nano-banana-2.1'
      })
    })
    const started = await h.service.start({ basedOn: [], prompt: 'A burner', versions: 2 })
    if (!started.ok) throw new Error('start failed')
    expect((await h.finished(started.jobId)).error?.code).toBe('no-credit')
  })
})
