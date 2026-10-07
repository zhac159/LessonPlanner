import { describe, expect, it } from 'vitest'
import { fixtureDeck, fixtureStyle } from '../deck/testing'
import { MAX_RENDER_PIXELS, isRenderJob, jobPixelSize, type RenderJob } from './renderJob'

const job = (over: Partial<RenderJob> = {}): RenderJob => ({
  id: 'job-1',
  slide: fixtureDeck().slides[2],
  style: fixtureStyle(),
  assets: { img1: 'data:image/png;base64,AAAA' },
  viewport: { x: 0, y: 0, w: 1920, h: 1080 },
  scale: 1280 / 1920,
  regions: [
    {
      n: 1,
      path: [
        [10, 10],
        [200, 10],
        [200, 120]
      ],
      bbox: { x: 10, y: 10, w: 190, h: 110 }
    }
  ],
  strokes: [
    [
      [5, 5],
      [50, 80]
    ]
  ],
  ...over
})

describe('jobPixelSize', () => {
  it('multiplies the viewport by the scale and rounds', () => {
    expect(jobPixelSize(job())).toEqual({ width: 1280, height: 720 })
    expect(jobPixelSize({ viewport: { x: 0, y: 0, w: 333, h: 111 }, scale: 1.5 })).toEqual({
      width: 500,
      height: 167
    })
  })

  it('is at least one pixel each way', () => {
    expect(jobPixelSize({ viewport: { x: 0, y: 0, w: 1, h: 1 }, scale: 0.05 })).toEqual({
      width: 1,
      height: 1
    })
  })
})

describe('isRenderJob', () => {
  it('accepts a well-formed job, with or without a style and regions', () => {
    expect(isRenderJob(job())).toBe(true)
    expect(isRenderJob(job({ style: null, regions: [], assets: {} }))).toBe(true)
  })

  it('accepts a crop viewport', () => {
    expect(isRenderJob(job({ viewport: { x: 900, y: 300, w: 600, h: 480 }, scale: 1.33 }))).toBe(
      true
    )
  })

  it.each([
    ['null', null],
    ['a string', 'job'],
    ['an array', []],
    ['an empty object', {}]
  ])('rejects %s', (_name, value) => {
    expect(isRenderJob(value)).toBe(false)
  })

  it('rejects a missing or empty id', () => {
    expect(isRenderJob(job({ id: '' }))).toBe(false)
    expect(isRenderJob({ ...job(), id: 5 })).toBe(false)
  })

  it('rejects a slide without elements', () => {
    expect(isRenderJob({ ...job(), slide: { id: 's1' } })).toBe(false)
    expect(isRenderJob({ ...job(), slide: 'x' })).toBe(false)
  })

  it('rejects a style that is neither null nor an object', () => {
    expect(isRenderJob({ ...job(), style: 'Lexend' })).toBe(false)
    expect(isRenderJob({ ...job(), style: undefined })).toBe(false)
  })

  it('only accepts data: image URLs as assets (no network, no files)', () => {
    expect(isRenderJob(job({ assets: { a: 'https://example.com/a.png' } }))).toBe(false)
    expect(isRenderJob(job({ assets: { a: 'file:///c:/secret.png' } }))).toBe(false)
    expect(isRenderJob({ ...job(), assets: { a: 5 } })).toBe(false)
    expect(isRenderJob({ ...job(), assets: [] })).toBe(false)
  })

  it('rejects viewports that are empty, negative, non-finite or outside the slide', () => {
    expect(isRenderJob(job({ viewport: { x: 0, y: 0, w: 0, h: 100 } }))).toBe(false)
    expect(isRenderJob(job({ viewport: { x: -1, y: 0, w: 100, h: 100 } }))).toBe(false)
    expect(isRenderJob(job({ viewport: { x: 0, y: 0, w: Number.NaN, h: 100 } }))).toBe(false)
    expect(isRenderJob(job({ viewport: { x: 1000, y: 0, w: 1000, h: 100 } }))).toBe(false)
    expect(isRenderJob(job({ viewport: { x: 0, y: 1000, w: 100, h: 100 } }))).toBe(false)
    expect(isRenderJob({ ...job(), viewport: null })).toBe(false)
  })

  it('rejects scales that are non-finite or would make an enormous window', () => {
    expect(isRenderJob(job({ scale: 0 }))).toBe(false)
    expect(isRenderJob(job({ scale: Number.POSITIVE_INFINITY }))).toBe(false)
    expect(isRenderJob(job({ scale: 100 }))).toBe(false)
    expect(isRenderJob(job({ scale: 4 }))).toBe(false)
    expect(MAX_RENDER_PIXELS).toBe(4096)
    expect(isRenderJob(job({ scale: 3.5 }))).toBe(false)
    expect(isRenderJob(job({ scale: 2 }))).toBe(true)
  })

  it('rejects malformed strokes', () => {
    expect(isRenderJob({ ...job(), strokes: undefined })).toBe(false)
    expect(isRenderJob({ ...job(), strokes: [[[1, 2, 3]]] })).toBe(false)
    expect(isRenderJob({ ...job(), strokes: ['line'] })).toBe(false)
    expect(isRenderJob(job({ strokes: [] }))).toBe(true)
  })

  it('rejects malformed regions', () => {
    const region = job().regions[0]
    expect(isRenderJob(job({ regions: [{ ...region, n: Number.NaN }] }))).toBe(false)
    expect(isRenderJob({ ...job(), regions: [{ ...region, path: [[1, 2, 3]] }] })).toBe(false)
    expect(isRenderJob({ ...job(), regions: [{ ...region, bbox: {} }] })).toBe(false)
    expect(isRenderJob({ ...job(), regions: 'none' })).toBe(false)
  })
})
