import { describe, expect, it } from 'vitest'
import {
  NANO_BANANA_PRO_MODEL,
  createNanoBananaMaker,
  estimatePictureCost,
  mapGeminiHttpError,
  readImage,
  type MakeImagesRequest
} from './nanoBanana'
import { GEMINI_BAD_KEY, GIF, JPEG, PNG, fakeFetch, geminiImageReply, json, text } from './testing'

const SECRET = 'AIzaSECRETKEY123'
const request = (over: Partial<MakeImagesRequest> = {}): MakeImagesRequest => ({
  prompt: 'A Bunsen burner with a lit flame',
  count: 1,
  aspect: '16:9',
  ...over
})
const maker = (
  fetchFn: ReturnType<typeof fakeFetch>['fetchFn'],
  getKey: () => string | undefined = () => SECRET
) => createNanoBananaMaker({ fetchFn, getKey })

describe('nano banana request', () => {
  it('posts generateContent to the Pro model with the key only in a header, text first then references', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(geminiImageReply()))
    const result = await maker(fetchFn).makeImages(
      request({ references: [PNG, JPEG, GIF, new Uint8Array([1, 2])], size: '1K' })
    )
    expect(result).toMatchObject({ ok: true, failed: 0 })
    const call = calls[0]
    expect(call.url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${NANO_BANANA_PRO_MODEL}:generateContent`
    )
    expect(call.url).not.toContain(SECRET)
    expect(call.init.method).toBe('POST')
    expect(call.headers['x-goog-api-key']).toBe(SECRET)
    const body = JSON.parse(call.init.body as string)
    expect(body.generationConfig).toEqual({
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: '16:9', imageSize: '1K' }
    })
    const parts = body.contents[0].parts
    expect(parts[0]).toEqual({ text: 'A Bunsen burner with a lit flame' })
    // GIF and unknown bytes are not usable references: PNG and JPEG are kept.
    expect(
      parts.slice(1).map((p: { inlineData: { mimeType: string } }) => p.inlineData.mimeType)
    ).toEqual(['image/png', 'image/jpeg'])
    expect(parts[1].inlineData.data).toBe(Buffer.from(PNG).toString('base64'))
  })

  it('defaults to 2K, caps references at the limit and uses a custom model', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(geminiImageReply()))
    const m = createNanoBananaMaker({
      fetchFn,
      getKey: () => 'k',
      model: 'gemini-nano-banana-2.1',
      maxReferences: 2
    })
    await m.makeImages(request({ references: [PNG, PNG, PNG, PNG] }))
    expect(calls[0].url).toContain('/models/gemini-nano-banana-2.1:generateContent')
    const body = JSON.parse(calls[0].init.body as string)
    expect(body.generationConfig.imageConfig.imageSize).toBe('2K')
    expect(body.contents[0].parts).toHaveLength(3)
  })

  it('makes one request per version and returns the final (non-thought) picture of each', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(geminiImageReply(PNG)))
    const result = await maker(fetchFn).makeImages(request({ count: 3 }))
    expect(calls).toHaveLength(3)
    expect(result.ok && result.images).toHaveLength(3)
    if (result.ok) {
      expect(result.images[0].mime).toBe('image/png')
      expect(Array.from(result.images[0].bytes)).toEqual(Array.from(PNG))
    }
  })

  it('returns what arrived when some versions fail, and the failure when none arrive', async () => {
    const mixed = fakeFetch((_c, i) =>
      i === 1 ? json({ error: { code: 503, message: 'busy' } }, 503) : json(geminiImageReply())
    )
    const partial = await maker(mixed.fetchFn).makeImages(request({ count: 3 }))
    expect(partial).toMatchObject({ ok: true, failed: 1 })
    const none = fakeFetch(() => json({ error: { code: 503, message: 'busy' } }, 503))
    expect(await maker(none.fetchFn).makeImages(request({ count: 2 }))).toMatchObject({
      ok: false,
      code: 'overloaded'
    })
  })

  it('stops asking for more versions after a failure that cannot change', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(GEMINI_BAD_KEY, 400))
    expect(await maker(fetchFn).makeImages(request({ count: 4 }))).toMatchObject({
      ok: false,
      code: 'invalid-key'
    })
    expect(calls.length).toBeLessThanOrEqual(2)
  })

  it('rejects an empty prompt and a missing key without any request', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(geminiImageReply()))
    expect(await maker(fetchFn).makeImages(request({ prompt: '   ' }))).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
    expect(await maker(fetchFn, () => undefined).makeImages(request())).toMatchObject({
      ok: false,
      code: 'no-key'
    })
    expect(calls).toHaveLength(0)
  })

  it('reports cancelled on abort and network on a dropped connection, and never leaks the key', async () => {
    const controller = new AbortController()
    controller.abort()
    const ok = fakeFetch(() => json(geminiImageReply()))
    expect(
      await maker(ok.fetchFn).makeImages(request({ signal: controller.signal }))
    ).toMatchObject({ ok: false, code: 'cancelled' })
    const down = fakeFetch(() => {
      throw new TypeError(`fetch failed for key=${SECRET}`)
    })
    const result = await maker(down.fetchFn).makeImages(request())
    expect(result).toMatchObject({ ok: false, code: 'network' })
    expect(JSON.stringify(result)).not.toContain(SECRET)
    const hang = fakeFetch(
      (call) =>
        new Promise<Response>((_, reject) =>
          call.init.signal?.addEventListener('abort', () => reject(new Error('x')))
        )
    )
    const slow = createNanoBananaMaker({
      fetchFn: hang.fetchFn,
      getKey: () => SECRET,
      timeoutMs: 20
    })
    expect(await slow.makeImages(request())).toMatchObject({
      ok: false,
      code: 'network',
      message: expect.stringContaining('too long')
    })
  })

  it('handles a reply that is not JSON', async () => {
    const { fetchFn } = fakeFetch(() => text('<html>oops</html>'))
    expect(await maker(fetchFn).makeImages(request())).toMatchObject({ ok: false, code: 'unknown' })
  })
})

describe('mapGeminiHttpError', () => {
  const body = (status: string, message: string, extra: object[] = []): string =>
    JSON.stringify({ error: { code: 0, status, message, details: extra } })
  it('maps a bad key (HTTP 400 with API_KEY_INVALID, as recorded) and a missing key', () => {
    expect(mapGeminiHttpError(400, JSON.stringify(GEMINI_BAD_KEY))).toMatchObject({
      code: 'invalid-key'
    })
    expect(mapGeminiHttpError(400, JSON.stringify([GEMINI_BAD_KEY]))).toMatchObject({
      code: 'invalid-key'
    })
    expect(mapGeminiHttpError(401, '')).toMatchObject({ code: 'invalid-key' })
    expect(
      mapGeminiHttpError(
        403,
        body(
          'PERMISSION_DENIED',
          "Method doesn't allow unregistered callers (callers without established identity)."
        )
      )
    ).toMatchObject({ code: 'invalid-key' })
  })
  it('maps billing problems to no-credit', () => {
    expect(
      mapGeminiHttpError(402, body('', 'Your prepay credit balance is depleted'))
    ).toMatchObject({ code: 'no-credit' })
    expect(
      mapGeminiHttpError(400, body('FAILED_PRECONDITION', 'Billing account is not enabled'))
    ).toMatchObject({ code: 'no-credit' })
    expect(
      mapGeminiHttpError(
        429,
        body(
          'RESOURCE_EXHAUSTED',
          'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0'
        )
      )
    ).toMatchObject({ code: 'no-credit' })
    expect(
      mapGeminiHttpError(
        429,
        body('RESOURCE_EXHAUSTED', 'You exceeded your daily quota', [{ reason: 'QUOTA_EXCEEDED' }])
      )
    ).toMatchObject({
      code: 'no-credit'
    })
  })
  it('maps rate limits with the suggested wait, and the rest', () => {
    expect(
      mapGeminiHttpError(
        429,
        body('RESOURCE_EXHAUSTED', 'Too many requests', [
          { '@type': 'RetryInfo', retryDelay: '34s' }
        ])
      )
    ).toMatchObject({ code: 'rate-limited', retryAfterSeconds: 34 })
    expect(mapGeminiHttpError(429, '')).toMatchObject({
      code: 'rate-limited',
      retryAfterSeconds: 30
    })
    expect(mapGeminiHttpError(403, body('PERMISSION_DENIED', 'nope'))).toMatchObject({
      code: 'permission'
    })
    expect(
      mapGeminiHttpError(
        400,
        body('FAILED_PRECONDITION', 'User location is not supported for the API use.')
      )
    ).toMatchObject({
      code: 'permission'
    })
    expect(mapGeminiHttpError(404, body('NOT_FOUND', 'models/x is not found'))).toMatchObject({
      code: 'model-unavailable'
    })
    expect(mapGeminiHttpError(413, '')).toMatchObject({ code: 'too-large' })
    expect(
      mapGeminiHttpError(400, body('INVALID_ARGUMENT', 'Request contains an invalid argument.'))
    ).toMatchObject({ code: 'invalid-input' })
    expect(mapGeminiHttpError(503, body('UNAVAILABLE', 'The model is overloaded.'))).toMatchObject({
      code: 'overloaded'
    })
    expect(mapGeminiHttpError(418, 'teapot')).toMatchObject({ code: 'unknown' })
  })
})

describe('readImage', () => {
  it('maps safety blocks and text-only answers to refused', () => {
    expect(readImage({ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } })).toMatchObject({
      failure: { code: 'refused' }
    })
    expect(readImage({ candidates: [{ finishReason: 'IMAGE_SAFETY' }] })).toMatchObject({
      failure: { code: 'refused' }
    })
    const textOnly = readImage({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'I cannot draw that.' }] } }]
    })
    expect(textOnly).toMatchObject({
      failure: { code: 'refused', message: expect.stringContaining('I cannot draw that.') }
    })
    expect(readImage(null)).toMatchObject({ failure: { code: 'refused' } })
  })
  it('accepts snake_case inline_data and ignores bytes that are not a picture', () => {
    const b64 = Buffer.from(PNG).toString('base64')
    expect(
      readImage({
        candidates: [
          { content: { parts: [{ inline_data: { mime_type: 'image/png', data: b64 } }] } }
        ]
      })
    ).toHaveProperty('image')
    expect(
      readImage({
        candidates: [
          {
            content: { parts: [{ inlineData: { data: Buffer.from('<html>').toString('base64') } }] }
          }
        ]
      })
    ).toHaveProperty('failure')
  })
})

describe('estimatePictureCost', () => {
  it('uses the list prices and gives null for unknown models', () => {
    expect(estimatePictureCost('gemini-3-pro-image', '2K', 4)).toBe(0.536)
    expect(estimatePictureCost('gemini-3-pro-image', '4K', 1)).toBe(0.24)
    expect(estimatePictureCost('gemini-nano-banana-2.1', '1K', 1)).toBe(0.0336)
    expect(estimatePictureCost('other', '1K', 1)).toBeNull()
  })
})
