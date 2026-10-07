import { describe, expect, it } from 'vitest'
import { attributionCredit, creditsForNotes } from './attribution'
import { createSearchProviders } from './index'
import { isFreeToUse, licenceFromCode, parseLicenceText } from './licences'
import { createQueryCache, createThrottle, polite, type Clock } from './limits'
import { COMMONS_BODY, OPENVERSE_BODY, fakeFetch, json } from './testing'
import type { ImageSearchProvider } from './types'

function fakeClock(): Clock & { t: number; slept: number[] } {
  const clock = {
    t: 1000,
    slept: [] as number[],
    now: () => clock.t,
    sleep: async (ms: number) => {
      clock.slept.push(ms)
      clock.t += ms
    }
  }
  return clock
}

describe('licences', () => {
  it('builds names, urls and flags from a code', () => {
    expect(licenceFromCode('by-sa', '4.0')).toEqual({
      code: 'by-sa',
      name: 'CC BY-SA 4.0',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      requiresAttribution: true,
      commercialOk: true
    })
    expect(licenceFromCode('cc0', '1.0')).toMatchObject({
      name: 'CC0 1.0',
      requiresAttribution: false
    })
    expect(licenceFromCode('pdm')).toMatchObject({ name: 'Public domain', commercialOk: true })
    expect(licenceFromCode('by-nc-nd', '3.0')).toMatchObject({ commercialOk: false })
    expect(licenceFromCode('mystery')).toMatchObject({
      code: 'other',
      name: 'mystery',
      commercialOk: false
    })
  })

  it('treats only CC0, public domain, BY, BY-SA and the free libraries as free to use', () => {
    const free = ['cc0', 'pdm', 'by', 'by-sa', 'pexels', 'unsplash'].map((c) =>
      isFreeToUse(licenceFromCode(c))
    )
    const notFree = ['by-nc', 'by-nd', 'by-nc-sa', 'by-nc-nd', 'other'].map((c) =>
      isFreeToUse(licenceFromCode(c))
    )
    expect(free.every(Boolean)).toBe(true)
    expect(notFree.some(Boolean)).toBe(false)
  })

  it('parses licence text as Commons writes it', () => {
    const code = (t: string): string => parseLicenceText(t).code
    expect(code('CC BY-SA 4.0')).toBe('by-sa')
    expect(code('cc-by-sa-3.0-de')).toBe('by-sa')
    expect(code('cc-by-4.0')).toBe('by')
    expect(code('CC BY-NC-ND 2.0')).toBe('by-nc-nd')
    expect(code('CC BY-NC-SA 3.0')).toBe('by-nc-sa')
    expect(code('CC BY-ND 4.0')).toBe('by-nd')
    expect(code('CC0')).toBe('cc0')
    expect(code('cc-zero')).toBe('cc0')
    expect(code('Public domain')).toBe('pdm')
    expect(code('PD-old-70')).toBe('pdm')
    expect(code('GFDL')).toBe('other')
    expect(code('')).toBe('other')
    expect(parseLicenceText('CC BY 2.0', 'https://x.org/l').url).toBe('https://x.org/l')
  })
})

describe('attributionCredit', () => {
  const by = licenceFromCode('by-sa', '2.0')
  it('credits a Creative Commons picture with title, author, licence and source', () => {
    expect(
      attributionCredit({
        title: 'Leaf In Sunlight',
        author: 'The Webhamster',
        licence: by,
        source: 'Flickr',
        sourceUrl: 'https://flickr.com/p/1'
      })
    ).toBe(
      '“Leaf In Sunlight” by The Webhamster, CC BY-SA 2.0 (https://creativecommons.org/licenses/by-sa/2.0/). Source: Flickr (https://flickr.com/p/1).'
    )
  })
  it('copes with a missing title or author, and says when no credit is needed', () => {
    expect(attributionCredit({ author: 'Ann', licence: by })).toBe(
      'Picture by Ann, CC BY-SA 2.0 (https://creativecommons.org/licenses/by-sa/2.0/).'
    )
    expect(
      attributionCredit({
        title: 'Oak',
        licence: licenceFromCode('cc0', '1.0'),
        source: 'Wikimedia Commons'
      })
    ).toContain('(no credit needed)')
  })
  it('credits AI pictures and ignores her own uploads', () => {
    expect(attributionCredit({ generatedBy: 'Nano Banana Pro' })).toBe(
      'Picture made with Nano Banana Pro (AI-generated).'
    )
    expect(attributionCredit({ title: 'My logo' })).toBe('')
  })
  it('builds one notes paragraph with unique lines', () => {
    const a = { generatedBy: 'Nano Banana Pro' }
    expect(creditsForNotes([a, a, { title: 'x' }])).toBe(
      'Picture credits: Picture made with Nano Banana Pro (AI-generated).'
    )
    expect(creditsForNotes([{ title: 'only mine' }])).toBe('')
  })
})

describe('throttle and cache', () => {
  it('spaces task starts by the minimum gap, one at a time', async () => {
    const clock = fakeClock()
    const schedule = createThrottle(500, clock)
    const starts: number[] = []
    const run = (): Promise<number> =>
      schedule(async () => (starts.push(clock.now()), starts.length))
    const results = await Promise.all([run(), run(), run()])
    expect(results).toEqual([1, 2, 3])
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(500)
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(500)
  })

  it('keeps going after a failed task', async () => {
    const schedule = createThrottle(0, fakeClock())
    await expect(schedule(async () => Promise.reject(new Error('x')))).rejects.toThrow('x')
    expect(await schedule(async () => 7)).toBe(7)
  })

  it('caches by key, shares in-flight loads, expires, evicts and never caches failures', async () => {
    const clock = fakeClock()
    const cache = createQueryCache<number>({ ttlMs: 1000, maxEntries: 2, clock })
    let loads = 0
    const load = async (): Promise<number> => ++loads
    expect(await Promise.all([cache.get('a', load), cache.get('a', load)])).toEqual([1, 1])
    expect(await cache.get('a', load)).toBe(1)
    clock.t += 1001
    expect(await cache.get('a', load)).toBe(2)
    await cache.get('b', load)
    await cache.get('c', load)
    expect(cache.size).toBe(2)
    await expect(cache.get('bad', () => Promise.reject(new Error('no')))).rejects.toThrow('no')
    await Promise.resolve()
    expect(await cache.get('bad', async () => 99)).toBe(99)
    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('polite() answers a repeated search from memory but treats other pages and filters as new', async () => {
    let n = 0
    const base: ImageSearchProvider = {
      id: 'x',
      label: 'X',
      search: async () => ({ items: [], hasMore: ++n > 0 })
    }
    const provider = polite(base, { clock: fakeClock(), minGapMs: 0 })
    const p = { query: 'Leaf', page: 1, perPage: 20, freeOnly: true }
    await provider.search(p)
    await provider.search({ ...p, query: ' leaf ' })
    expect(n).toBe(1)
    await provider.search({ ...p, page: 2 })
    await provider.search({ ...p, freeOnly: false })
    await provider.search({ ...p, kinds: ['photo'] })
    expect(n).toBe(4)
  })
})

describe('createSearchProviders', () => {
  it('always has Openverse and Commons; keyed providers only when their key getter is given', () => {
    const { fetchFn } = fakeFetch(() => json({}))
    expect(createSearchProviders({ fetchFn }).map((p) => p.id)).toEqual(['openverse', 'commons'])
    expect(
      createSearchProviders({ fetchFn, getPexelsKey: () => 'a', getUnsplashKey: () => 'b' }).map(
        (p) => p.id
      )
    ).toEqual(['openverse', 'commons', 'pexels', 'unsplash'])
  })

  it('throttles and caches the providers it builds', async () => {
    const clock = fakeClock()
    const { fetchFn, calls } = fakeFetch((call) =>
      json(call.url.includes('openverse') ? OPENVERSE_BODY : COMMONS_BODY)
    )
    const [openverse, commons] = createSearchProviders({ fetchFn, clock })
    const p = { query: 'cave painting', page: 1, perPage: 20, freeOnly: true }
    await openverse.search(p)
    await openverse.search(p)
    await commons.search(p)
    expect(calls).toHaveLength(2)
    // A second, different Openverse query has to wait the 20-per-minute gap.
    await openverse.search({ ...p, query: 'leaf' })
    expect(clock.slept.some((ms) => ms >= 3000)).toBe(true)
  })
})
