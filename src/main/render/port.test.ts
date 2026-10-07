import { describe, expect, it, vi } from 'vitest'
import { fixtureDeck, makeSlide } from '@shared/deck/testing'
import type { ImageElement } from '@shared/deck/types'
import type { SlideRenderRequest } from '../services/lessons/types'
import { createSlideRendererPort, type RenderViewOptions, type ViewRenderer } from './port'

const picture: ImageElement = {
  id: 'pic',
  type: 'image',
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  fit: 'cover',
  alt: 'leaf',
  assetId: 'leaf.png'
}

function fakeRenderer(bytes = new Uint8Array([9])): ViewRenderer & { calls: RenderViewOptions[] } {
  const calls: RenderViewOptions[] = []
  return {
    calls,
    renderView: async (options) => {
      calls.push(options)
      return bytes
    }
  }
}

const request = (over: Partial<SlideRenderRequest> = {}): SlideRenderRequest => ({
  slide: fixtureDeck().slides[0],
  style: null,
  width: 480,
  height: 270,
  ...over
})

describe('createSlideRendererPort', () => {
  it('renders the whole slide at the requested size and returns the bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const renderer = fakeRenderer(bytes)
    const port = createSlideRendererPort(renderer)
    await expect(port.renderSlidePng(request())).resolves.toBe(bytes)
    expect(renderer.calls[0]).toMatchObject({
      viewport: { x: 0, y: 0, w: 1920, h: 1080 },
      width: 480,
      height: 270,
      style: null
    })
  })

  it('maps crop to the viewport', async () => {
    const renderer = fakeRenderer()
    await createSlideRendererPort(renderer).renderSlidePng(
      request({ crop: { x: 100, y: 200, w: 300, h: 400 } })
    )
    expect(renderer.calls[0].viewport).toEqual({ x: 100, y: 200, w: 300, h: 400 })
  })

  it('turns marks into numbered loops with their bounding boxes, and passes strokes on', async () => {
    const renderer = fakeRenderer()
    const path: Array<[number, number]> = [
      [100, 100],
      [400, 120],
      [300, 500]
    ]
    const strokes: Array<Array<[number, number]>> = [
      [
        [1, 1],
        [9, 9]
      ]
    ]
    await createSlideRendererPort(renderer).renderSlidePng(
      request({ marks: [{ n: 2, path }], strokes })
    )
    expect(renderer.calls[0].regions).toEqual([
      { n: 2, path, bbox: { x: 100, y: 100, w: 300, h: 400 } }
    ])
    expect(renderer.calls[0].strokes).toBe(strokes)
  })

  it('reads only the assets the slide uses, skipping the ones that are missing', async () => {
    const renderer = fakeRenderer()
    const readAsset = vi.fn(async (id: string) =>
      id === 'leaf.png' ? new Uint8Array([7, 7]) : undefined
    )
    const slide = makeSlide('s1', {
      elements: [picture, { ...picture, id: 'gone', assetId: 'gone.png' }]
    })
    await createSlideRendererPort(renderer).renderSlidePng(request({ slide, readAsset }))
    expect(readAsset.mock.calls.map(([id]) => id)).toEqual(['leaf.png', 'gone.png'])
    expect(renderer.calls[0].assets).toEqual({ 'leaf.png': new Uint8Array([7, 7]) })
  })

  it('works without readAsset and without marks', async () => {
    const renderer = fakeRenderer()
    const slide = makeSlide('s1', { elements: [picture] })
    await createSlideRendererPort(renderer).renderSlidePng(request({ slide }))
    expect(renderer.calls[0].assets).toEqual({})
    expect(renderer.calls[0].regions).toBeUndefined()
  })

  it('exposes nothing but renderSlidePng', () => {
    const richer = { renderView: vi.fn(), dispose: vi.fn() }
    expect(Object.keys(createSlideRendererPort(richer))).toEqual(['renderSlidePng'])
  })

  it('passes failures on unchanged', async () => {
    const port = createSlideRendererPort({
      renderView: () => Promise.reject(new Error('no window'))
    })
    await expect(port.renderSlidePng(request())).rejects.toThrow('no window')
  })

  it('fails when reading an asset fails', async () => {
    const slide = makeSlide('s1', { elements: [picture] })
    const port = createSlideRendererPort(fakeRenderer())
    await expect(
      port.renderSlidePng(
        request({
          slide,
          readAsset: () => Promise.reject(new Error('disk gone'))
        })
      )
    ).rejects.toThrow('disk gone')
  })
})
