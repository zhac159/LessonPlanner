import { describe, expect, it } from 'vitest'
import { createCommonsProvider, resizedThumb } from './commons'
import { clip, plainText } from './text'
import { ImageProviderError, guard, toFailure } from './errors'
import { createPexelsProvider, createUnsplashProvider } from './keyed'
import { createOpenverseProvider } from './openverse'
import {
  COMMONS_BODY,
  OPENVERSE_BODY,
  PEXELS_BODY,
  UNSPLASH_BODY,
  fakeFetch,
  json,
  text
} from './testing'
import type { ImageSearchParams } from './types'

const params = (over: Partial<ImageSearchParams> = {}): ImageSearchParams => ({
  query: 'leaf in sunlight',
  page: 1,
  perPage: 20,
  freeOnly: true,
  ...over
})

const UA = 'SlidePlanner/9.9 (test; contact: test@example.org)'

describe('openverse', () => {
  it('searches with the free licence filter, a User-Agent and keeps attribution data', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(OPENVERSE_BODY))
    const provider = createOpenverseProvider({ fetchFn, userAgent: UA })
    const result = await provider.search(params({ perPage: 50, kinds: ['photo'] }))
    const url = new URL(calls[0].url)
    expect(url.origin + url.pathname).toBe('https://api.openverse.org/v1/images/')
    expect(url.searchParams.get('q')).toBe('leaf in sunlight')
    expect(url.searchParams.get('license')).toBe('cc0,pdm,by,by-sa')
    expect(url.searchParams.get('page_size')).toBe('20')
    expect(url.searchParams.get('category')).toBe('photograph')
    expect(url.searchParams.get('mature')).toBe('false')
    expect(calls[0].headers['user-agent']).toBe(UA)
    // NC dropped client-side as well (defence in depth), SVG dropped.
    expect(result.items.map((i) => i.id)).toEqual([
      '288699a3-4094-473a-a77b-39b27596c4bf',
      'zero-1'
    ])
    const [leaf, oak] = result.items
    expect(leaf).toMatchObject({
      providerId: 'openverse',
      title: 'Leaf In Sunlight',
      author: 'The Webhamster',
      source: 'Flickr',
      sourceUrl: 'https://www.flickr.com/photos/40041412@N06/3999881122',
      width: 1024,
      height: 685,
      licence: {
        code: 'by-sa',
        name: 'CC BY-SA 2.0',
        requiresAttribution: true,
        commercialOk: true
      }
    })
    expect(leaf.thumbnailUrl).toContain('/thumb/')
    expect(leaf.attributionText).toContain('“Leaf In Sunlight” by The Webhamster')
    expect(leaf.attributionText).toContain('CC BY-SA 2.0')
    expect(oak.source).toBe('Wikimedia Commons')
    expect(oak.licence.requiresAttribution).toBe(false)
    expect(result.hasMore).toBe(true)
  })

  it('includes NC results when freeOnly is off, flagged as not commercial', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(OPENVERSE_BODY))
    const result = await createOpenverseProvider({ fetchFn }).search(params({ freeOnly: false }))
    expect(new URL(calls[0].url).searchParams.has('license')).toBe(false)
    const nc = result.items.find((i) => i.id === 'nc-1')
    expect(nc?.licence).toMatchObject({ code: 'by-nc', commercialOk: false })
  })

  it('returns an empty page, and hasMore false on the last page', async () => {
    const { fetchFn } = fakeFetch(() => json({ result_count: 0, page_count: 0, results: [] }))
    expect(await createOpenverseProvider({ fetchFn }).search(params())).toEqual({
      items: [],
      hasMore: false
    })
  })

  it('sends a bearer token when one is configured', async () => {
    const { fetchFn, calls } = fakeFetch(() => json({ results: [] }))
    await createOpenverseProvider({ fetchFn, getToken: () => 'tok' }).search(params())
    expect(calls[0].headers.authorization).toBe('Bearer tok')
  })

  it('maps failures: 429 with a wait, malformed JSON, 400, network, abort, timeout', async () => {
    const limited = fakeFetch(() =>
      json({ detail: 'Request was throttled. Expected available in 3412 seconds.' }, 429)
    )
    await expect(
      createOpenverseProvider({ fetchFn: limited.fetchFn }).search(params())
    ).rejects.toMatchObject({
      code: 'rate-limited',
      retryAfterSeconds: 3412
    })
    const retryHeader = fakeFetch(() => text('slow', 429, { 'retry-after': '12' }))
    await expect(
      createOpenverseProvider({ fetchFn: retryHeader.fetchFn }).search(params())
    ).rejects.toMatchObject({
      retryAfterSeconds: 12
    })
    const bad = fakeFetch(() => text('<html>not json</html>'))
    await expect(
      createOpenverseProvider({ fetchFn: bad.fetchFn }).search(params())
    ).rejects.toMatchObject({
      code: 'unknown'
    })
    const four = fakeFetch(() =>
      json({ detail: { license: ["License 'x' does not exist."] } }, 400)
    )
    await expect(
      createOpenverseProvider({ fetchFn: four.fetchFn }).search(params())
    ).rejects.toMatchObject({
      code: 'invalid-input'
    })
    const down = fakeFetch(() => {
      throw new TypeError('fetch failed')
    })
    await expect(
      createOpenverseProvider({ fetchFn: down.fetchFn }).search(params())
    ).rejects.toMatchObject({
      code: 'network'
    })
    const controller = new AbortController()
    controller.abort()
    const aborted = fakeFetch(() => json({}))
    await expect(
      createOpenverseProvider({ fetchFn: aborted.fetchFn }).search(
        params({ signal: controller.signal })
      )
    ).rejects.toMatchObject({ code: 'cancelled' })
    const slow = fakeFetch(
      (call) =>
        new Promise<Response>((_, reject) => {
          call.init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )
    await expect(
      createOpenverseProvider({ fetchFn: slow.fetchFn, timeoutMs: 20 }).search(params())
    ).rejects.toMatchObject({ code: 'network', message: expect.stringContaining('too long') })
  })

  it('cleans HTML and long text that some sources put in title and creator', async () => {
    const junk = `<div class='fn'><b>Cave &amp; art</b></div>${'x'.repeat(300)}`
    const { fetchFn } = fakeFetch(() =>
      json({
        page_count: 1,
        results: [
          {
            id: 'j',
            url: 'https://example.org/j.jpg',
            title: junk,
            creator: '<a href="x">Ann</a>',
            license: 'by',
            license_version: '4.0'
          }
        ]
      })
    )
    const [item] = (await createOpenverseProvider({ fetchFn }).search(params())).items
    expect(item.title.startsWith('Cave & art')).toBe(true)
    expect(item.title.length).toBeLessThanOrEqual(120)
    expect(item.title).not.toContain('<')
    expect(item.author).toBe('Ann')
    expect(clip('short', 10)).toBe('short')
  })

  it('tolerates odd result objects without throwing', async () => {
    const { fetchFn } = fakeFetch(() =>
      json({ page_count: 1, results: [null, 5, {}, { id: 'x', url: 'http://insecure/x.jpg' }] })
    )
    expect((await createOpenverseProvider({ fetchFn }).search(params())).items).toEqual([])
  })
})

describe('wikimedia commons', () => {
  it('sends the api params and both User-Agent headers, orders by index, filters licences', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(COMMONS_BODY))
    const result = await createCommonsProvider({ fetchFn, userAgent: UA }).search(
      params({ query: 'cave painting', page: 2, perPage: 4 })
    )
    const url = new URL(calls[0].url)
    expect(url.origin + url.pathname).toBe('https://commons.wikimedia.org/w/api.php')
    expect(url.searchParams.get('generator')).toBe('search')
    expect(url.searchParams.get('gsrnamespace')).toBe('6')
    expect(url.searchParams.get('gsrsearch')).toBe('cave painting filetype:bitmap')
    expect(url.searchParams.get('gsroffset')).toBe('4')
    expect(url.searchParams.get('gsrlimit')).toBe('4')
    expect(url.searchParams.get('iiprop')).toContain('extmetadata')
    expect(calls[0].headers['user-agent']).toBe(UA)
    expect(calls[0].headers['api-user-agent']).toBe(UA)
    // kept: 1 (BY-SA), 2 (BY-SA), 4 (PD), 5 (huge, BY-SA), 6 (svg render). Dropped: NC, tiff, GFDL.
    expect(result.items.map((i) => i.id)).toEqual(['1', '2', '4', '5', '6'])
    const [maligrad, dorawaka, oldMap, huge, water] = result.items
    expect(maligrad).toMatchObject({
      title: 'Cave Painting, Maligrad Island',
      author: 'Ardit & Alimemeti',
      source: 'Wikimedia Commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cave_Painting,_Maligrad_Island.jpg',
      licence: { code: 'by-sa', name: 'CC BY-SA 4.0', requiresAttribution: true }
    })
    expect(maligrad.fullUrl).toMatch(/\/d\/da\/Cave Painting, Maligrad Island\.jpg$/)
    expect(dorawaka.title).toBe('Dorawaka cave')
    expect(dorawaka.author).toBe('Kasun Perera 18')
    expect(oldMap.licence).toMatchObject({ code: 'pdm', requiresAttribution: false })
    expect(huge.fullUrl).toContain('/1920px-')
    expect(water.fullUrl).toContain('/1280px-')
    expect(water.fullUrl.endsWith('.png')).toBe(true)
    expect(result.hasMore).toBe(true)
  })

  it('keeps NC and unknown licences only when freeOnly is off', async () => {
    const { fetchFn } = fakeFetch(() => json(COMMONS_BODY))
    const result = await createCommonsProvider({ fetchFn }).search(params({ freeOnly: false }))
    const codes = result.items.map((i) => i.licence.code)
    expect(codes).toContain('by-nc')
    expect(codes).toContain('other')
    expect(result.items.find((i) => i.licence.code === 'by-nc')?.licence.commercialOk).toBe(false)
  })

  it('asks for drawings too when no photo kind is wanted', async () => {
    const { fetchFn, calls } = fakeFetch(() => json({ query: { pages: [] } }))
    const result = await createCommonsProvider({ fetchFn }).search(
      params({ kinds: ['diagram', 'icon'] })
    )
    expect(new URL(calls[0].url).searchParams.get('gsrsearch')).toContain('filetype:bitmap|drawing')
    expect(result).toEqual({ items: [], hasMore: false })
  })

  it('handles no hits (no query key), HTTP errors and malformed JSON', async () => {
    const none = fakeFetch(() => json({ batchcomplete: true }))
    expect(await createCommonsProvider({ fetchFn: none.fetchFn }).search(params())).toEqual({
      items: [],
      hasMore: false
    })
    const blocked = fakeFetch(() => text('<html>Wikimedia Error</html>', 429))
    await expect(
      createCommonsProvider({ fetchFn: blocked.fetchFn }).search(params())
    ).rejects.toMatchObject({
      code: 'rate-limited'
    })
    const broken = fakeFetch(() => text('{"query":'))
    await expect(
      createCommonsProvider({ fetchFn: broken.fetchFn }).search(params())
    ).rejects.toBeInstanceOf(ImageProviderError)
  })

  it('reduces HTML metadata to text and resizes standard thumbnails', () => {
    expect(plainText('<a href="x">A &amp; B</a> &#169; &#x41;<br/>&nbsp;ok')).toBe('A & B © A ok')
    expect(resizedThumb('https://t/x/330px-Foo.svg.png?utm_source=a', 1280)).toBe(
      'https://t/x/1280px-Foo.svg.png?utm_source=a'
    )
  })
})

describe('pexels', () => {
  it('needs a key, sends it raw in Authorization and maps a photo', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(PEXELS_BODY))
    let key: string | undefined
    const provider = createPexelsProvider({ fetchFn, getKey: () => key, userAgent: UA })
    await expect(provider.search(params())).rejects.toMatchObject({ code: 'no-key' })
    expect(calls).toHaveLength(0)
    key = 'pex-key'
    const result = await provider.search(params({ perPage: 200 }))
    expect(calls[0].headers.authorization).toBe('pex-key')
    expect(new URL(calls[0].url).searchParams.get('per_page')).toBe('80')
    expect(result.hasMore).toBe(true)
    expect(result.items[0]).toMatchObject({
      id: '1181',
      author: 'Jane Doe',
      authorUrl: 'https://www.pexels.com/@jane',
      fullUrl: 'https://images.pexels.com/photos/1181/large2x.jpeg',
      licence: { code: 'pexels', commercialOk: true }
    })
    expect(result.items[0].attributionText).toBe(
      'Photo by Jane Doe (https://www.pexels.com/@jane) on Pexels (https://www.pexels.com/photo/green-leaf-1181/).'
    )
  })

  it('answers non-photo searches with nothing, and a bad key with invalid-key', async () => {
    const { fetchFn, calls } = fakeFetch(() => json({}, 401))
    const provider = createPexelsProvider({ fetchFn, getKey: () => 'k' })
    expect(await provider.search(params({ kinds: ['icon'] }))).toEqual({
      items: [],
      hasMore: false
    })
    expect(calls).toHaveLength(0)
    await expect(provider.search(params())).rejects.toMatchObject({ code: 'invalid-key' })
  })
})

describe('unsplash', () => {
  it('uses Client-ID auth, adds UTM links and keeps the tracking URL', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(UNSPLASH_BODY))
    const provider = createUnsplashProvider({ fetchFn, getKey: () => 'uns-key' })
    const result = await provider.search(params())
    expect(calls[0].headers.authorization).toBe('Client-ID uns-key')
    expect(new URL(calls[0].url).searchParams.get('content_filter')).toBe('high')
    expect(result.hasMore).toBe(true)
    const item = result.items[0]
    expect(item.title).toBe('a leaf with sun behind it')
    expect(item.fullUrl).toContain('ixid=x')
    expect(item.sourceUrl).toBe(
      'https://unsplash.com/photos/abc123?utm_source=slide_planner&utm_medium=referral'
    )
    expect(item.attributionText).toContain(
      'Photo by Ana Lopez (https://unsplash.com/@ana?utm_source=slide_planner'
    )
    expect(item.attributionText).toContain('on Unsplash')
    expect(item.trackingUrl).toContain('/download')
  })

  it('pings the download location when a photo is picked, and never throws', async () => {
    const { fetchFn, calls } = fakeFetch((_c, i) => json(i === 0 ? UNSPLASH_BODY : { url: 'x' }))
    const provider = createUnsplashProvider({ fetchFn, getKey: () => 'uns-key' })
    const item = (await provider.search(params())).items[0]
    expect(await provider.registerUse?.(item)).toBe(true)
    expect(calls.at(-1)?.url).toBe(item.trackingUrl)
    expect(calls.at(-1)?.headers.authorization).toBe('Client-ID uns-key')
    const failing = createUnsplashProvider({
      fetchFn: fakeFetch(() => json({}, 500)).fetchFn,
      getKey: () => 'k'
    })
    expect(await failing.registerUse?.(item)).toBe(false)
    const noKey = createUnsplashProvider({ fetchFn, getKey: () => undefined })
    expect(await noKey.registerUse?.(item)).toBe(false)
  })
})

describe('error helpers', () => {
  it('turns provider errors into Failures and wraps calls in a Result', async () => {
    expect(toFailure(new ImageProviderError('rate-limited', 'slow', 5))).toEqual({
      ok: false,
      code: 'rate-limited',
      message: 'slow',
      retryAfterSeconds: 5
    })
    expect(toFailure(Object.assign(new Error('x'), { name: 'AbortError' }))).toMatchObject({
      code: 'cancelled'
    })
    expect(toFailure('weird')).toMatchObject({ ok: false, code: 'unknown' })
    expect(await guard(async () => ({ n: 1 }))).toEqual({ ok: true, n: 1 })
    expect(
      await guard(async () => {
        throw new ImageProviderError('network', 'down')
      })
    ).toMatchObject({ ok: false, code: 'network' })
  })
})
