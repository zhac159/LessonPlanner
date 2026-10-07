import { afterEach, describe, expect, it } from 'vitest'
import { licenceFromCode } from '../../imageProviders/licences'
import type { ImageSearchItem } from '../../imageProviders/types'
import { cleanTemp, tempDir, testService } from '../testing'
import { createPureImageTools } from '../thumbs'
import { createAppOnlineService, WIKIMEDIA_CONTACT, slidePlannerUserAgent } from './index'
import {
  assetKindOf,
  cleanOnlineTitle,
  creditOf,
  imageKindsOf,
  licenceOf,
  onlineProviderOf,
  tagsFromQuery
} from './mapping'
import { RESULT_TTL_MS, ResultRegistry } from './results'

afterEach(cleanTemp)

const item = (over: Partial<ImageSearchItem> = {}): ImageSearchItem => ({
  id: '1',
  providerId: 'commons',
  title: 'File:Volcano cross section.jpg',
  thumbnailUrl: 'https://upload.example/t.jpg',
  fullUrl: 'https://upload.example/f.jpg',
  width: 1600,
  height: 1200,
  source: 'Wikimedia Commons',
  sourceUrl: 'https://commons.example/File:Volcano',
  author: 'Ana Perez',
  licence: licenceFromCode('by-sa', '4.0'),
  attributionText: '',
  ...over
})

describe('mapping', () => {
  it('maps provider ids and refuses unknown ones', () => {
    expect(onlineProviderOf('commons')).toBe('wikimedia')
    expect(onlineProviderOf('openverse')).toBe('openverse')
    expect(onlineProviderOf('pexels')).toBe('pexels')
    expect(onlineProviderOf('flickr')).toBeNull()
  })

  it('maps licences with the label the provider printed and the credit rule', () => {
    expect(licenceOf(licenceFromCode('by-sa', '4.0'))).toEqual({
      id: 'cc-by-sa',
      label: 'CC BY-SA 4.0',
      requiresCredit: true
    })
    expect(licenceOf(licenceFromCode('cc0', '1.0'))).toMatchObject({
      id: 'cc0',
      requiresCredit: false
    })
    expect(licenceOf(licenceFromCode('pdm'))).toMatchObject({
      id: 'public-domain',
      label: 'Public domain'
    })
    expect(licenceOf(licenceFromCode('pexels'))).toMatchObject({
      id: 'pexels',
      requiresCredit: true
    })
    expect(licenceOf(licenceFromCode('by-nc', '2.0'))).toMatchObject({
      id: 'cc-by-nc',
      label: 'CC BY-NC 2.0'
    })
    expect(
      licenceOf(licenceFromCode('Some odd licence text that is very long indeed, really'))
    ).toEqual({ id: 'other', label: 'Check the licence', requiresCredit: true })
  })

  it('builds the credit once: the provider line when it has one, else our own', () => {
    const own = creditOf(item(), 'wikimedia')
    expect(own).toMatchObject({
      inNotes: true,
      provider: 'wikimedia',
      author: 'Ana Perez',
      title: 'File:Volcano cross section.jpg',
      pageUrl: 'https://commons.example/File:Volcano'
    })
    expect(own.text).toContain('Ana Perez')
    expect(own.text).toContain('CC BY-SA 4.0')
    expect(creditOf(item({ attributionText: 'Ready line.' }), 'wikimedia').text).toBe('Ready line.')
    expect(
      creditOf(item({ licence: licenceFromCode('cc0', '1.0'), author: '' }), 'openverse')
    ).toMatchObject({
      inNotes: false,
      author: null
    })
  })

  it('maps the A9 filter, the kind guess, tags and titles', () => {
    expect(imageKindsOf('any')).toBeUndefined()
    expect(imageKindsOf('photo')).toEqual(['photo'])
    expect(imageKindsOf('drawing')).toEqual(['illustration', 'icon'])
    expect(imageKindsOf('diagram')).toEqual(['diagram'])
    expect(assetKindOf('photo', 'openverse', 'png')).toBe('photo')
    expect(assetKindOf('drawing', 'pexels', 'jpg')).toBe('picture')
    expect(assetKindOf('any', 'pexels', 'png')).toBe('photo')
    expect(assetKindOf('any', 'wikimedia', 'jpg')).toBe('photo')
    expect(assetKindOf('any', 'wikimedia', 'png')).toBe('picture')
    expect(tagsFromQuery('The leaf in sunlight, a leaf')).toEqual(['leaf', 'sunlight'])
    expect(cleanOnlineTitle('File:Volcano_cross_section.JPG')).toBe('Volcano cross section')
    expect(cleanOnlineTitle('   ')).toBe('Picture from the web')
  })
})

describe('result registry', () => {
  it('keeps results for ten minutes and then forgets them, in memory and on disk', async () => {
    const dir = await tempDir()
    let now = 1_000_000
    const registry = new ResultRegistry(dir, () => now)
    const [id] = await registry.put([item()], { filter: 'any', query: 'volcano' })
    expect(id).toMatch(/^ovr_/)
    expect((await registry.get(id!))?.query).toBe('volcano')
    expect((await new ResultRegistry(dir, () => now).get(id!))?.item.title).toContain('Volcano')
    now += RESULT_TTL_MS + 1
    expect(await registry.get(id!)).toBeUndefined()
    expect(await new ResultRegistry(dir, () => now).get(id!)).toBeUndefined()
  })

  it('prunes old files and ignores ids that are not ours', async () => {
    const dir = await tempDir()
    let now = 5_000_000
    const registry = new ResultRegistry(dir, () => now)
    const [old] = await registry.put([item()], { filter: 'any', query: 'a' })
    now += RESULT_TTL_MS - 1000
    const [fresh] = await registry.put([item()], { filter: 'any', query: 'b' })
    now += 2000
    await registry.prune()
    const again = new ResultRegistry(dir, () => now)
    expect(await again.get(old!)).toBeUndefined()
    expect((await again.get(fresh!))?.query).toBe('b')
    expect(await registry.get('../../etc/passwd')).toBeUndefined()
    await new ResultRegistry(`${dir}-missing`, () => now).prune()
  })
})

describe('app wiring', () => {
  it('builds the fake online service in fake mode and sends a User-Agent with the one contact constant', async () => {
    const dir = await tempDir()
    const assets = testService(`${dir}/assets`)
    await assets.init()
    const online = createAppOnlineService({
      assets,
      tools: createPureImageTools(),
      dir: `${dir}/online`,
      fake: true,
      version: '1.2.3'
    })
    const found = await online.search({ query: 'owl', kind: 'any', freeToUse: true, page: 1 })
    expect(found.ok && found.results).toHaveLength(24)
    expect(slidePlannerUserAgent('1.2.3')).toBe(
      `SlidePlanner/1.2.3 (${WIKIMEDIA_CONTACT}; desktop lesson planner)`
    )
  })

  it('has no Pexels unless a key reader is given', async () => {
    const dir = await tempDir()
    const assets = testService(`${dir}/assets`)
    await assets.init()
    const calls: string[] = []
    const fetchFn = async (url: string): Promise<Response> => {
      calls.push(new URL(url).hostname)
      return new Response(JSON.stringify({ results: [], query: { pages: {} } }), {
        headers: { 'content-type': 'application/json' }
      })
    }
    const online = createAppOnlineService({
      assets,
      tools: createPureImageTools(),
      dir: `${dir}/online`,
      fetchFn,
      getPexelsKey: () => 'k'.repeat(20)
    })
    const found = await online.search({ query: 'owl', kind: 'any', freeToUse: true, page: 1 })
    expect(found.ok && found.providers.map((p) => p.provider)).toEqual([
      'openverse',
      'wikimedia',
      'pexels'
    ])
    expect(calls).toContain('api.pexels.com')
  })
})
