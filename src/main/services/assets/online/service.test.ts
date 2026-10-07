import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImageProviderError } from '../../imageProviders/errors'
import type { FetchFn, ImageSearchProvider } from '../../imageProviders/types'
import { cleanTemp, tempDir, testService } from '../testing'
import { createPureImageTools } from '../thumbs'
import { createFakeSearchProviders, fakeFetch, fakePng, pngResponse } from './fake'
import { OnlineService, type OnlineServiceDeps } from './service'
import type { OnlineReviewPort } from './types'

afterEach(cleanTemp)

async function setup(over: Partial<OnlineServiceDeps> = {}) {
  const dir = await tempDir()
  const assets = testService(join(dir, 'assets'))
  await assets.init()
  let clock = Date.parse('2026-10-07T10:00:00.000Z')
  const fetchCalls: string[] = []
  const fetchFn: FetchFn = (url, init) => {
    fetchCalls.push(url)
    return fakeFetch(url, init)
  }
  const make = (extra: Partial<OnlineServiceDeps> = {}) =>
    new OnlineService({
      providers: createFakeSearchProviders(),
      fetchFn,
      tools: createPureImageTools(),
      assets,
      dir: join(dir, 'online'),
      now: () => clock,
      ...over,
      ...extra
    })
  return { dir, assets, online: make(), make, fetchCalls, advance: (ms: number) => (clock += ms) }
}

const query = (over = {}) => ({
  query: 'leaf in sunlight',
  kind: 'any' as const,
  freeToUse: true,
  page: 1,
  ...over
})

async function firstPage(online: OnlineService, over = {}) {
  const found = await online.search(query(over))
  if (!found.ok) throw new Error(found.message)
  return found
}

describe('search', () => {
  it('returns one page of 24 from both libraries, interleaved, with thumbnails and licences', async () => {
    const { online } = await setup()
    const found = await firstPage(online)
    expect(found.results).toHaveLength(24)
    expect(found.providers).toEqual([
      { provider: 'openverse', ok: true },
      { provider: 'wikimedia', ok: true }
    ])
    expect(found.results.slice(0, 4).map((r) => r.provider)).toEqual([
      'openverse',
      'wikimedia',
      'openverse',
      'wikimedia'
    ])
    expect(found.results.every((r) => r.thumbDataUrl?.startsWith('data:image/png;base64,'))).toBe(
      true
    )
    expect(
      found.results.every((r) =>
        ['CC BY-SA 4.0', 'CC0 1.0', 'CC BY 2.0', 'Public domain'].includes(r.licence.label)
      )
    ).toBe(true)
    expect(found.results[0]).toMatchObject({
      providerLabel: 'Openverse',
      author: 'A. Teacher',
      width: 1600,
      licence: { id: 'cc-by-sa', requiresCredit: true }
    })
    expect(found).toMatchObject({ page: 1, hasMore: true, total: 24 })
    expect(new Set(found.results.map((r) => r.id)).size).toBe(24)
  })

  it('proposes names that are valid, free and different from each other', async () => {
    const { online, assets } = await setup()
    const first = await firstPage(online)
    expect(first.results[0]?.proposedName).toBe('leaf_in_sunlight_close_up_1')
    const names = first.results.map((r) => r.proposedName)
    expect(new Set(names).size).toBe(names.length)
    expect(
      names.every((n) => assets.takenNames().indexOf(n) === -1 && /^[a-z0-9_]{2,32}$/.test(n))
    ).toBe(true)
  })

  it('pages: the second page is the last one in the fixtures', async () => {
    const { online } = await setup()
    const second = await firstPage(online, { page: 2 })
    expect(second).toMatchObject({ page: 2, hasMore: false, total: 24 + second.results.length })
  })

  it('keeps NC and ND pictures out unless "Free to use in lessons" is off', async () => {
    const { online } = await setup()
    const free = await firstPage(online)
    expect(free.results.some((r) => r.licence.id === 'cc-by-nc')).toBe(false)
    const all = await firstPage(online, { freeToUse: false })
    expect(all.results.some((r) => r.licence.id === 'cc-by-nc')).toBe(true)
    expect(all.results.some((r) => r.licence.id === 'cc-by-nd')).toBe(true)
  })

  it('still shows the other library when one fails', async () => {
    const [openverse, commons] = createFakeSearchProviders()
    const broken: ImageSearchProvider = {
      ...openverse!,
      search: () => Promise.reject(new ImageProviderError('network', 'down'))
    }
    const { make } = await setup()
    const found = await firstPage(make({ providers: [broken, commons!] }))
    expect(found.providers).toEqual([
      { provider: 'openverse', ok: false },
      { provider: 'wikimedia', ok: true }
    ])
    expect(found.results.length).toBeGreaterThan(0)
    expect(found.results.every((r) => r.provider === 'wikimedia')).toBe(true)
  })

  it('says the libraries are busy when every one is rate limited, and keeps retryAfter', async () => {
    const { make } = await setup()
    const limited: ImageSearchProvider = {
      id: 'openverse',
      label: 'Openverse',
      search: () => Promise.reject(new ImageProviderError('rate-limited', 'slow', 30))
    }
    expect(await make({ providers: [limited] }).search(query())).toEqual({
      ok: false,
      code: 'rate-limited',
      message: 'The image libraries are busy. Try again in a minute.',
      retryAfterSeconds: 30
    })
    const down: ImageSearchProvider = { ...limited, search: () => Promise.reject(new Error('x')) }
    expect(await make({ providers: [down] }).search(query())).toMatchObject({
      ok: false,
      code: 'network'
    })
  })

  it('refuses an empty search and clamps nonsense paging', async () => {
    const { online } = await setup()
    expect(await online.search(query({ query: '   ' }))).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
    expect((await firstPage(online, { page: -4, kind: 'weird' })).page).toBe(1)
  })

  it('finds nothing without failing', async () => {
    const { make } = await setup()
    const empty: ImageSearchProvider = {
      id: 'openverse',
      label: 'Openverse',
      search: async () => ({ items: [], hasMore: false })
    }
    expect(await make({ providers: [empty] }).search(query())).toMatchObject({
      ok: true,
      results: [],
      hasMore: false
    })
  })

  it('fetches each thumbnail once per session', async () => {
    const { online, fetchCalls } = await setup()
    await firstPage(online)
    await firstPage(online)
    expect(fetchCalls).toHaveLength(24)
  })
})

describe('saving one result', () => {
  it('downloads it and saves picture, licence, credit and source', async () => {
    const { online, assets } = await setup()
    const found = await firstPage(online)
    const pick = found.results[0]!
    const saved = await online.add([{ id: pick.id }], 'direct')
    expect(saved.ok && 'added' in saved && saved.added).toHaveLength(1)
    const added = saved.ok && 'added' in saved ? saved.added : []
    const asset = assets.getAsset(added[0]!.id)!
    expect(asset).toMatchObject({
      name: pick.proposedName,
      title: 'leaf in sunlight close up 1',
      source: { kind: 'online', provider: 'openverse' },
      licence: { id: 'cc-by-sa', label: 'CC BY-SA 4.0', requiresCredit: true },
      credit: { inNotes: true, provider: 'openverse', author: 'A. Teacher', pageUrl: pick.pageUrl }
    })
    expect(asset.credit?.text).toContain('CC BY-SA 4.0')
    expect(asset.credit?.licenceUrl).toContain('creativecommons.org')
    expect(asset.tags).toEqual(['leaf', 'sunlight'])
    expect(asset.kind).toBe('picture')
    expect(asset.file.width).toBe(96)
  })

  it('credits that need none are stored but not sent to the notes', async () => {
    const { online, assets } = await setup()
    const found = await firstPage(online)
    const cc0 = found.results.find((r) => r.licence.id === 'cc0')!
    const saved = await online.saveResult(cc0.id)
    expect(saved.ok && saved.asset.credit).toMatchObject({ inNotes: false })
    expect(assets.libraryCount).toBe(1)
  })

  it('uses the name she typed, refuses a bad one before downloading anything', async () => {
    const { online, assets, fetchCalls } = await setup()
    const found = await firstPage(online)
    const before = fetchCalls.length
    const bad = await online.saveResult(found.results[0]!.id, 'x')
    expect(bad).toEqual({ ok: false, code: 'invalid-input', message: 'Use at least 2 characters.' })
    expect(fetchCalls.length).toBe(before)
    const good = await online.saveResult(found.results[0]!.id, 'Volcano Cross Section')
    expect(good.ok && good.asset.name).toBe('volcano_cross_section')
    const clash = await online.saveResult(found.results[1]!.id, 'volcano_cross_section')
    expect(clash).toMatchObject({
      ok: false,
      message: 'You already have an asset called volcano_cross_section.'
    })
    expect(assets.libraryCount).toBe(1)
  })

  it('returns the picture she already has instead of saving it twice', async () => {
    const { online, assets } = await setup()
    const found = await firstPage(online)
    const first = await online.saveResult(found.results[0]!.id)
    const again = await online.saveResult(found.results[0]!.id)
    expect(first.ok && first.created).toBe(true)
    expect(again.ok && again.created).toBe(false)
    expect(again.ok && first.ok && again.asset.id).toBe(first.ok && first.asset.id)
    expect(assets.libraryCount).toBe(1)
  })

  it('lets Claude name it when she did not, but never overrides a typed name', async () => {
    const describe = vi.fn(async () => ({
      title: 'Sunlit leaf',
      name: 'sunlit_leaf',
      kind: 'photo' as const,
      description: 'A green leaf in bright sun.',
      tags: ['leaf', 'sun']
    }))
    const { online } = await setup({ describe: { describe } })
    const found = await firstPage(online)
    const named = await online.saveResult(found.results[0]!.id)
    expect(named.ok && named.asset).toMatchObject({
      name: 'sunlit_leaf',
      title: 'Sunlit leaf',
      kind: 'photo'
    })
    const typed = await online.saveResult(found.results[1]!.id, 'my_leaf')
    expect(typed.ok && typed.asset).toMatchObject({
      name: 'my_leaf',
      title: 'leaf in sunlight close up 1'
    })
    expect(describe).toHaveBeenCalledTimes(1)
  })

  it('falls back to the title when describing fails', async () => {
    const { online } = await setup({
      describe: { describe: async () => Promise.reject(new Error('no key')) }
    })
    const found = await firstPage(online)
    expect((await online.saveResult(found.results[0]!.id)).ok).toBe(true)
  })

  it('knows the kind she searched for', async () => {
    const { online } = await setup()
    const found = await firstPage(online, { kind: 'diagram' })
    const saved = await online.saveResult(found.results[0]!.id)
    expect(saved.ok && saved.asset.kind).toBe('diagram')
  })

  it('says a result has expired after ten minutes, and finds it again from disk after a restart', async () => {
    const { online, make, advance } = await setup()
    const found = await firstPage(online)
    const restarted = make()
    expect((await restarted.saveResult(found.results[0]!.id)).ok).toBe(true)
    advance(10 * 60_000 + 1)
    expect(await online.saveResult(found.results[1]!.id)).toEqual({
      ok: false,
      code: 'not-found',
      message: 'That search result has expired. Search again.'
    })
    expect(await online.saveResult('nonsense')).toMatchObject({ code: 'not-found' })
  })

  it('reports a picture that is gone or not a picture', async () => {
    const gone: FetchFn = async (url) =>
      url.includes('/full.png') ? new Response('', { status: 404 }) : fakeFetch(url)
    const { make } = await setup()
    const online = make({ fetchFn: gone })
    const found = await firstPage(online)
    expect(await online.saveResult(found.results[0]!.id)).toMatchObject({
      ok: false,
      code: 'not-found'
    })
    const html: FetchFn = async (url) =>
      url.includes('/full.png') ? new Response('<html>hi</html>', { status: 200 }) : fakeFetch(url)
    const htmlOnline = make({ fetchFn: html })
    const again = await firstPage(htmlOnline)
    expect(await htmlOnline.saveResult(again.results[0]!.id)).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
  })

  it('pings a library that wants to hear about downloads (Unsplash)', async () => {
    const registerUse = vi.fn(async () => true)
    const [openverse] = createFakeSearchProviders()
    const { make } = await setup()
    const online = make({ providers: [{ ...openverse!, registerUse }] })
    const found = await firstPage(online)
    await online.saveResult(found.results[0]!.id)
    await vi.waitFor(() => expect(registerUse).toHaveBeenCalledTimes(1))
  })
})

describe('online:add', () => {
  it('direct saves several and skips the ones that fail', async () => {
    const { online, assets } = await setup()
    const found = await firstPage(online)
    const result = await online.add(
      [
        { id: found.results[0]!.id },
        { id: 'ovr_missing' },
        { id: found.results[1]!.id, name: 'second_pick' }
      ],
      'direct'
    )
    expect(result.ok && 'added' in result && result.added.map((a) => a.name)).toEqual([
      found.results[0]!.proposedName,
      'second_pick'
    ])
    expect(assets.libraryCount).toBe(2)
  })

  it('fails when nothing could be saved, and for an empty or huge pick', async () => {
    const { online } = await setup()
    expect(await online.add([{ id: 'ovr_missing' }], 'direct')).toMatchObject({
      ok: false,
      code: 'not-found'
    })
    expect(await online.add([], 'direct')).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(
      await online.add(
        Array.from({ length: 25 }, () => ({ id: 'a' })),
        'review'
      )
    ).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
  })

  it('review hands downloaded candidates, with licences and credits, to the review queue', async () => {
    const batches: unknown[][] = []
    const review: OnlineReviewPort = {
      addOnlineBatch: async (candidates) => {
        batches.push(candidates)
        return { batchId: 'bat_1' }
      }
    }
    const { online, assets } = await setup({ review })
    const found = await firstPage(online)
    const result = await online.add(
      found.results.slice(0, 3).map((r) => ({ id: r.id })),
      'review'
    )
    expect(result).toEqual({ ok: true, batchId: 'bat_1' })
    expect(batches[0]).toHaveLength(3)
    expect(batches[0]![0]).toMatchObject({
      ext: '.png',
      source: { kind: 'online', provider: 'openverse' },
      licence: { id: 'cc-by-sa' },
      credit: { inNotes: true },
      autoName: true
    })
    expect(assets.libraryCount).toBe(0)
  })

  it('review without a queue, or when the queue fails, is a plain failure', async () => {
    const { online, make } = await setup()
    const found = await firstPage(online)
    const ids = found.results.slice(0, 2).map((r) => ({ id: r.id }))
    expect(await online.add(ids, 'review')).toMatchObject({ ok: false, code: 'io' })
    const warn = vi.fn()
    const failing = make({
      review: { addOnlineBatch: async () => Promise.reject(new Error('disk')) },
      log: { warn }
    })
    expect(await failing.add(ids, 'review')).toMatchObject({ ok: false, code: 'io' })
    expect(warn).toHaveBeenCalled()
  })

  it('review leaves out a picture that is the same file twice', async () => {
    const same: FetchFn = async () => pngResponse(fakePng('same'))
    const seen: unknown[][] = []
    const { make } = await setup()
    const online = make({
      fetchFn: same,
      review: { addOnlineBatch: async (c) => (seen.push(c), { batchId: 'b' }) }
    })
    const found = await firstPage(online)
    await online.add(
      found.results.slice(0, 3).map((r) => ({ id: r.id })),
      'review'
    )
    expect(seen[0]).toHaveLength(1)
  })
})
