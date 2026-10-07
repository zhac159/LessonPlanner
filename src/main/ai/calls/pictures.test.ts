/** The picture calls against a scripted SDK stub (no network): request shape, mapping, cache, batching. */
import { describe, expect, it } from 'vitest'
import type { DescribeImageInput } from '@shared/ai/types'
import { createAiService } from '../index'
import { createRig, createStub, jsonMessage } from '../testing'
import { defaultDeps } from './deps'
import {
  createMemoryDescribeCache,
  describeAssets,
  describeStyleOfAssets,
  drawSvg,
  type DescribeCache
} from './pictures'

const PNG = (n: number): Uint8Array => Uint8Array.of(0x89, 0x50, 0x4e, 0x47, n)
const JPG = Uint8Array.of(0xff, 0xd8, 0xff, 1)

const picture = (index: number, extra: Partial<DescribeImageInput> = {}): DescribeImageInput => ({
  index,
  png: PNG(index),
  hint: 'other',
  nearbyText: '',
  fileNames: ['L1.pdf'],
  ...extra
})

const item = (index: number, extra: Record<string, unknown> = {}) => ({
  index,
  title: 'School logo',
  name: `thing_${index}`,
  kind: 'logo',
  description: 'A blue crest.',
  tags: ['Crest', 'blue'],
  maybePupils: false,
  blurry: false,
  olderVersionOf: -1,
  ...extra
})

const setup = (script: Parameters<typeof createRig>[0]) => {
  const rig = createRig(script, 'claude-opus-5-5')
  return { rig, deps: defaultDeps(rig.runner) }
}

describe('describeAssets', () => {
  it('asks the cheaper model at low effort: a label and an image per picture, then the facts', async () => {
    const { rig, deps } = setup([jsonMessage({ items: [item(7), item(9)] })])
    await describeAssets(
      deps,
      {
        images: [
          picture(7, { hint: 'logo', nearbyText: 'Welcome', fileNames: ['a.pdf'] }),
          picture(9, { png: JPG })
        ],
        taken: ['school_logo']
      },
      {}
    )
    const [request] = rig.stub.requests
    expect(request).toMatchObject({
      model: 'claude-sonnet-5-5',
      output_config: { effort: 'low', format: { type: 'json_schema' } }
    })
    const content = request.messages[0]!.content as unknown as Array<Record<string, unknown>>
    expect(content.map((b) => b.type)).toEqual(['text', 'image', 'text', 'image', 'text'])
    expect(content[0]).toMatchObject({ text: 'Picture 7:' })
    expect((content[1] as { source: { media_type: string } }).source.media_type).toBe('image/png')
    expect((content[3] as { source: { media_type: string } }).source.media_type).toBe('image/jpeg')
    const task = (content[4] as { text: string }).text
    expect(task).toContain('Picture 7 · looks like: logo · text near it: "Welcome" · from: a.pdf')
    expect(task).toContain('Names already taken: school_logo')
    expect(rig.usage[0]).toMatchObject({ task: 'describeAssets' })
  })

  it('cleans the answer: unique names, tidy tags, the older-version link inside the batch', async () => {
    const { deps } = setup([
      jsonMessage({
        items: [
          item(1, { name: 'school_logo', olderVersionOf: 2 }),
          item(2, { name: 'School Logo', olderVersionOf: 99 }),
          item(3, { name: 'slide', kind: 'photo', tags: ['A', 'a', 'b', 'c', 'd', 'e', 'f'] })
        ]
      })
    ])
    const { described } = await describeAssets(
      deps,
      { images: [picture(1), picture(2), picture(3)], taken: ['SCHOOL_LOGO'] },
      {}
    )
    expect(described.map((d) => d.name)).toEqual(['school_logo_2', 'school_logo_3', 'slide_image'])
    expect(described.map((d) => d.olderVersionOf)).toEqual([2, null, null])
    expect(described[2]).toMatchObject({ kind: 'photo', tags: ['a', 'b', 'c', 'd', 'e'] })
  })

  it('describes a picture once: the second call is served from the cache, with a fresh name check', async () => {
    const { rig, deps } = setup([jsonMessage({ items: [item(1, { name: 'beaker_icon' })] })])
    const cache = createMemoryDescribeCache()
    const first = await describeAssets(deps, { images: [picture(1)], taken: [] }, {}, cache)
    const again = await describeAssets(
      deps,
      { images: [picture(5, { png: PNG(1) })], taken: ['beaker_icon'] },
      {},
      cache
    )
    expect(rig.stub.requests).toHaveLength(1)
    expect(first.described[0]!.name).toBe('beaker_icon')
    expect(again.described[0]).toMatchObject({
      index: 5,
      name: 'beaker_icon_2',
      title: 'School logo'
    })
  })

  it('uses the caller’s sha256 as the cache key and never lets a broken cache fail the call', async () => {
    const seen: string[] = []
    const broken: DescribeCache = {
      get: () => {
        throw new Error('disk full')
      },
      set: (sha) => {
        seen.push(sha)
        throw new Error('disk full')
      }
    }
    const { deps } = setup([jsonMessage({ items: [item(1)] })])
    const { described } = await describeAssets(
      deps,
      { images: [picture(1, { sha256: 'abc' })], taken: [] },
      {},
      broken
    )
    expect(described).toHaveLength(1)
    expect(seen).toEqual(['abc'])
  })

  it('sends identical pictures once and names each of them', async () => {
    const { rig, deps } = setup([jsonMessage({ items: [item(1, { name: 'leaf_photo' })] })])
    const same = PNG(1)
    const { described } = await describeAssets(
      deps,
      { images: [picture(1, { png: same }), picture(2, { png: same })], taken: [] },
      {}
    )
    expect(rig.stub.requests).toHaveLength(1)
    expect(described.map((d) => d.name)).toEqual(['leaf_photo', 'leaf_photo_2'])
  })

  it('splits more than 12 pictures into requests of at most 12', async () => {
    const batch = (from: number, to: number) =>
      jsonMessage({
        items: Array.from({ length: to - from + 1 }, (_, i) => item(from + i))
      })
    const { rig, deps } = setup([batch(0, 11), batch(12, 12)])
    const images = Array.from({ length: 13 }, (_, i) => picture(i))
    const { described } = await describeAssets(deps, { images, taken: [] }, {})
    expect(rig.stub.requests).toHaveLength(2)
    expect(described).toHaveLength(13)
    const second = rig.stub.requests[1]!.messages[0]!.content as unknown[]
    expect(second).toHaveLength(3)
  })

  it('drops numbers it was not given, and fails when nothing usable comes back', async () => {
    const { deps } = setup([jsonMessage({ items: [item(1), item(40)] })])
    const { described } = await describeAssets(deps, { images: [picture(1)], taken: [] }, {})
    expect(described.map((d) => d.index)).toEqual([1])

    const { deps: empty } = setup([jsonMessage({ items: [item(40)] })])
    await expect(
      describeAssets(empty, { images: [picture(1)], taken: [] }, {})
    ).rejects.toMatchObject({ failure: { code: 'unknown' } })
  })

  it('refuses two pictures with the same number, and answers an empty list with an empty list', async () => {
    const { rig, deps } = setup([])
    await expect(
      describeAssets(deps, { images: [picture(1), picture(1, { png: PNG(2) })], taken: [] }, {})
    ).rejects.toMatchObject({ failure: { code: 'invalid-input' } })
    expect(await describeAssets(deps, { images: [], taken: [] }, {})).toEqual({ described: [] })
    expect(rig.stub.requests).toHaveLength(0)
  })
})

describe('describeStyleOfAssets', () => {
  it('sends at most 6 labelled pictures with the style question and returns a clean paragraph', async () => {
    const { rig, deps } = setup([
      jsonMessage({ description: '**Flat** vector,   thick   navy outlines (#1F3A5F).' })
    ])
    const out = await describeStyleOfAssets(
      deps,
      { images: Array.from({ length: 8 }, (_, i) => PNG(i)), kinds: ['icon', 'logo'] },
      {}
    )
    expect(out.description).toBe('Flat vector, thick navy outlines (#1F3A5F).')
    const [request] = rig.stub.requests
    expect(request).toMatchObject({ model: 'claude-sonnet-5-5' })
    const content = request.messages[0]!.content as unknown as Array<Record<string, unknown>>
    expect(content.filter((b) => b.type === 'image')).toHaveLength(6)
    expect(content[0]).toMatchObject({ text: 'Picture 1 (icon):' })
    expect(content[4]).toMatchObject({ text: 'Picture 3:' })
    expect((content.at(-1) as { text: string }).text).toContain('at most 60 words')
  })

  it('needs at least one picture, and an empty answer is a failure', async () => {
    const { deps } = setup([jsonMessage({ description: '  ' })])
    await expect(describeStyleOfAssets(deps, { images: [], kinds: [] }, {})).rejects.toMatchObject({
      failure: { code: 'invalid-input' }
    })
    await expect(
      describeStyleOfAssets(deps, { images: [PNG(1)], kinds: ['icon'] }, {})
    ).rejects.toMatchObject({ failure: { code: 'unknown' } })
  })
})

const SVG = (inner: string, viewBox = '0 0 400 400') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inner}</svg>`

describe('drawSvg', () => {
  const ask = { prompt: 'a beaker', styleDescription: 'flat, navy outlines', kind: 'icon' as const }

  it('asks for the right number of versions in the kind’s viewBox and sanitises every drawing', async () => {
    const { rig, deps } = setup([
      jsonMessage({
        svgs: [
          SVG(
            '<circle cx="200" cy="200" r="80" fill="#0E9AA7" onload="x()"/><script>alert(1)</script>'
          ),
          SVG('<rect x="10" y="10" width="50" height="50"/>'),
          '<div>not an svg</div>',
          SVG('')
        ]
      })
    ])
    const { svgs } = await drawSvg(deps, { ...ask, versions: 4 }, {})
    expect(svgs).toHaveLength(2)
    expect(svgs[0]).toContain('<circle')
    expect(svgs.join('')).not.toMatch(/script|onload/)
    const [request] = rig.stub.requests
    expect(request).toMatchObject({ model: 'claude-sonnet-5-5' })
    const text = (request.messages[0]!.content as Array<{ text: string }>)[0]!.text
    expect(text).toContain('Draw 4 versions of: a beaker')
    expect(text).toContain('viewBox="0 0 400 400"')
    expect(text).toContain('Match this style: flat, navy outlines')
  })

  it('uses a 4:3 box for diagrams, caps versions at 4 and keeps no more than were asked', async () => {
    const drawing = (n: number) => SVG(`<rect x="${n}" y="1" width="9" height="9"/>`, '0 0 400 300')
    const { rig, deps } = setup([jsonMessage({ svgs: [drawing(1), drawing(2), drawing(3)] })])
    const { svgs } = await drawSvg(deps, { ...ask, kind: 'diagram', versions: 2 }, {})
    expect(svgs).toHaveLength(2)
    const text = (rig.stub.requests[0]!.messages[0]!.content as Array<{ text: string }>)[0]!.text
    expect(text).toContain('viewBox="0 0 400 300"')
  })

  it('refuses photos and empty requests without calling Claude; fails when no drawing survives', async () => {
    const { rig, deps } = setup([jsonMessage({ svgs: ['nope'] })])
    await expect(drawSvg(deps, { ...ask, kind: 'photo', versions: 2 }, {})).rejects.toMatchObject({
      failure: { code: 'invalid-input' }
    })
    await expect(drawSvg(deps, { ...ask, prompt: ' ', versions: 2 }, {})).rejects.toMatchObject({
      failure: { code: 'invalid-input' }
    })
    expect(rig.stub.requests).toHaveLength(0)
    await expect(drawSvg(deps, { ...ask, versions: 1 }, {})).rejects.toMatchObject({
      failure: { code: 'unknown' }
    })
  })
})

describe('through the service', () => {
  it('returns Results, records the cheaper model and keeps one cache for the whole service', async () => {
    const stub = createStub([jsonMessage({ items: [item(1)] })])
    const usage: Array<{ model: string; task: string }> = []
    const ai = createAiService({
      getApiKey: () => 'sk-ant-api03-test',
      getModel: () => 'claude-opus-5-5',
      createClient: () => stub.client,
      usage: { record: (entry) => void usage.push(entry) }
    })
    const first = await ai.describeAssets({ images: [picture(1)], taken: [] })
    const second = await ai.describeAssets({ images: [picture(1)], taken: [] })
    expect(first).toMatchObject({ ok: true })
    expect(second).toMatchObject({ ok: true })
    expect(stub.requests).toHaveLength(1)
    expect(usage[0]).toMatchObject({ task: 'describeAssets' })
    expect(stub.requests[0]).toMatchObject({ model: 'claude-sonnet-5-5' })
    expect(
      await ai.drawSvg({ prompt: 'x', styleDescription: '', kind: 'photo', versions: 2 })
    ).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
  })
})
