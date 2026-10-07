import { describe, expect, it } from 'vitest'
import { createFakeAiService } from '../fake'

const image = (index: number, nearbyText = '', hint: 'logo' | 'photo' | 'other' = 'other') => ({
  index,
  png: Uint8Array.of(index),
  hint,
  nearbyText,
  fileNames: []
})

describe('fake picture calls', () => {
  it('names pictures from the words near them and the kind, uniquely and deterministically', async () => {
    const ai = createFakeAiService()
    const input = {
      images: [image(1, 'Welcome back', 'logo'), image(2, '', 'photo'), image(3, '', 'photo')],
      taken: ['photo']
    }
    const first = await ai.describeAssets(input)
    expect(first).toMatchObject({ ok: true })
    if (!first.ok) return
    expect(first.described.map((d) => [d.index, d.name, d.kind])).toEqual([
      [1, 'welcome_back_logo', 'logo'],
      [2, 'photo_2', 'photo'],
      [3, 'photo_3', 'photo']
    ])
    expect(await ai.describeAssets(input)).toEqual(first)
  })

  it('describes a style, and refuses an empty pick', async () => {
    const ai = createFakeAiService()
    const out = await ai.describeStyleOfAssets({ images: [Uint8Array.of(1)], kinds: ['icon'] })
    expect(out).toMatchObject({ ok: true })
    expect(await ai.describeStyleOfAssets({ images: [], kinds: [] })).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
  })

  it('draws sanitised SVGs in the kind’s box and refuses photos', async () => {
    const ai = createFakeAiService()
    const drawn = await ai.drawSvg({
      prompt: 'beaker',
      styleDescription: '',
      kind: 'banner',
      versions: 2
    })
    expect(drawn.ok && drawn.svgs).toHaveLength(2)
    if (drawn.ok) expect(drawn.svgs[0]).toContain('viewBox="0 0 420 180"')
    expect(
      await ai.drawSvg({ prompt: 'beaker', styleDescription: '', kind: 'photo', versions: 2 })
    ).toMatchObject({ ok: false, code: 'invalid-input' })
  })

  it('honours failWith and cancellation like every other call', async () => {
    const failing = createFakeAiService({ failWith: 'no-key' })
    expect(await failing.describeAssets({ images: [image(1)], taken: [] })).toMatchObject({
      ok: false,
      code: 'no-key'
    })
    const controller = new AbortController()
    controller.abort()
    expect(
      await createFakeAiService().drawSvg(
        { prompt: 'x', styleDescription: '', kind: 'icon', versions: 1 },
        { signal: controller.signal }
      )
    ).toMatchObject({ ok: false, code: 'cancelled' })
  })
})
