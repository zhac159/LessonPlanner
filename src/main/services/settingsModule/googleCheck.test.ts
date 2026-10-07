import { describe, expect, it } from 'vitest'
import { GEMINI_BAD_KEY, fakeFetch, json } from '../imageProviders/testing'
import {
  checkGoogleKey,
  fakeGoogleFetch,
  looksLikeGoogleApiKey,
  redactGoogleKeys
} from './googleCheck'

const KEY = 'AIzaSyD-SECRETSECRETSECRETSECRET0123456'
const NEW_KEY = 'AQ.Ab8RN6SECRETSECRETSECRETSECRETSECRET_abcdefg-123'
const PRO = 'gemini-3-pro-image'

const models = (...names: string[]) => ({
  models: names.map((name) => ({ name: `models/${name}` }))
})

describe('checkGoogleKey', () => {
  it('lists the models with the key only in a header and finds the chosen one', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(models('gemini-2.5-flash', PRO)))
    expect(await checkGoogleKey({ key: KEY, model: PRO, fetchFn })).toEqual({
      ok: true,
      model: PRO
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/v1beta/models?')
    expect(calls[0].url).not.toContain('AIza')
    expect(calls[0].headers['x-goog-api-key']).toBe(KEY)
    expect(calls[0].init.method ?? 'GET').toBe('GET')
    expect(calls[0].init.body).toBeUndefined()
  })

  it('follows next-page tokens until the model shows up', async () => {
    const { fetchFn, calls } = fakeFetch((_call, index) =>
      index === 0
        ? json({ ...models('a', 'b'), nextPageToken: 'T2' })
        : json(models('gemini-nano-banana-2.1'))
    )
    const result = await checkGoogleKey({ key: KEY, model: 'gemini-nano-banana-2.1', fetchFn })
    expect(result.ok).toBe(true)
    expect(calls[1].url).toContain('pageToken=T2')
  })

  it('says model-unavailable when the key works but the model is not offered (only an exact id counts)', async () => {
    const { fetchFn } = fakeFetch(() =>
      json(models('gemini-3-pro-image-preview', 'gemini-2.5-pro'))
    )
    expect(await checkGoogleKey({ key: KEY, model: PRO, fetchFn })).toMatchObject({
      ok: false,
      code: 'model-unavailable',
      message: 'That picture maker isn’t available on this key.'
    })
  })

  it('maps Gemini’s HTTP 400 API_KEY_INVALID to invalid-key (it is not a 401)', async () => {
    const { fetchFn } = fakeFetch(() => json(GEMINI_BAD_KEY, 400))
    expect(await checkGoogleKey({ key: KEY, model: PRO, fetchFn })).toMatchObject({
      ok: false,
      code: 'invalid-key'
    })
  })

  it.each([
    [
      402,
      { error: { code: 402, message: 'Payment Required: prepay credit depleted' } },
      'no-credit'
    ],
    [
      429,
      { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Too many' } },
      'rate-limited'
    ],
    [403, { error: { code: 403, status: 'PERMISSION_DENIED', message: 'nope' } }, 'permission'],
    [503, { error: { code: 503, message: 'busy' } }, 'overloaded']
  ])('maps HTTP %i to %s', async (status, body, code) => {
    const { fetchFn } = fakeFetch(() => json(body, status))
    expect(await checkGoogleKey({ key: KEY, model: PRO, fetchFn })).toMatchObject({
      ok: false,
      code
    })
  })

  it('reports network when the request throws, without echoing the key from the error', async () => {
    const fetchFn = async (): Promise<Response> => {
      throw new Error(`connect failed for ${KEY}`)
    }
    const result = await checkGoogleKey({ key: KEY, model: PRO, fetchFn })
    expect(result).toMatchObject({ ok: false, code: 'network' })
    expect(JSON.stringify(result)).not.toContain('AIza')
  })

  it('reports an unreadable reply as unknown', async () => {
    const { fetchFn } = fakeFetch(() => new Response('<html>', { status: 200 }))
    expect(await checkGoogleKey({ key: KEY, model: PRO, fetchFn })).toMatchObject({
      ok: false,
      code: 'unknown'
    })
  })

  it('redacts a key that a provider message happens to echo', async () => {
    const { fetchFn } = fakeFetch(() =>
      json({ error: { code: 403, status: 'PERMISSION_DENIED', message: `blocked ${KEY}` } }, 403)
    )
    const result = await checkGoogleKey({ key: KEY, model: PRO, fetchFn })
    expect(JSON.stringify(result)).not.toContain('SECRETSECRET')
  })

  it('has a fake fetch that lists both picture models (fake-AI runs)', async () => {
    expect(
      await checkGoogleKey({ key: KEY, model: 'gemini-nano-banana-2.1', fetchFn: fakeGoogleFetch })
    ).toMatchObject({ ok: true })
  })
})

describe('redactGoogleKeys', () => {
  it('hides key-shaped text and the exact key', () => {
    expect(redactGoogleKeys(`x ${KEY} y`)).toBe('x AIza… y')
    expect(redactGoogleKeys('secret-abc', 'secret-abc')).not.toContain('secret-abc')
  })
})

describe('looksLikeGoogleApiKey', () => {
  it('accepts the classic AIza key and the newer AQ. auth key, with stray whitespace', () => {
    expect(looksLikeGoogleApiKey(KEY)).toBe(true)
    expect(
      looksLikeGoogleApiKey(` ${NEW_KEY.slice(0, 20)}
${NEW_KEY.slice(20)} `)
    ).toBe(true)
  })

  it('refuses other text, including a Claude key and truncated keys', () => {
    for (const bad of ['', 'AIzaShort', 'AQ.short', 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz'])
      expect(looksLikeGoogleApiKey(bad), bad).toBe(false)
  })

  it('redacts both shapes', () => {
    expect(redactGoogleKeys(`a ${NEW_KEY} b`)).toBe('a AIza… b')
  })
})
