import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixtureDeck, fixtureStyle, makeSlide } from '@shared/deck/testing'
import type { ImageElement } from '@shared/deck/types'
import type { RenderJob } from '@shared/annotate/renderJob'
import { RenderError, SlideRenderer, type RenderSurface } from './SlideRenderer'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

interface Call {
  job: RenderJob
  finish: (bytes?: Uint8Array) => void
  fail: (error: Error) => void
}

/** A surface whose renders stay pending until the test finishes them. */
function manualSurface(): RenderSurface & { calls: Call[]; disposed: boolean } {
  const surface = {
    calls: [] as Call[],
    disposed: false,
    render(job: RenderJob): Promise<Uint8Array> {
      return new Promise((resolve, reject) => {
        surface.calls.push({ job, finish: (bytes = PNG) => resolve(bytes), fail: reject })
      })
    },
    dispose(): void {
      surface.disposed = true
      for (const call of surface.calls) call.fail(new Error('disposed'))
    }
  }
  return surface
}

/** A surface that answers at once. */
const instantSurface = (): RenderSurface & { jobs: RenderJob[]; disposed: boolean } => {
  const surface = {
    jobs: [] as RenderJob[],
    disposed: false,
    render: async (job: RenderJob) => {
      surface.jobs.push(job)
      return PNG
    },
    dispose: () => {
      surface.disposed = true
    }
  }
  return surface
}

const slide = fixtureDeck().slides[2]
const style = fixtureStyle()
const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

afterEach(() => {
  vi.useRealTimers()
})

describe('SlideRenderer jobs', () => {
  it('renders a slide at the requested width: whole slide, scale = width / 1920', async () => {
    const surface = instantSurface()
    const renderer = new SlideRenderer({ createSurface: () => surface })
    const png = await renderer.renderSlidePng({ slide, style, width: 960 })
    expect(png).toBe(PNG)
    const job = surface.jobs[0]
    expect(job.viewport).toEqual({ x: 0, y: 0, w: 1920, h: 1080 })
    expect(job.scale).toBeCloseTo(0.5)
    expect(job.slide).toBe(slide)
    expect(job.style).toBe(style)
    expect(job.regions).toEqual([])
  })

  it('defaults to 1280 pixels wide and passes regions through', async () => {
    const surface = instantSurface()
    const renderer = new SlideRenderer({ createSurface: () => surface })
    const region = {
      n: 1,
      path: [
        [10, 10],
        [300, 10],
        [300, 200]
      ] as Array<[number, number]>,
      bbox: { x: 10, y: 10, w: 290, h: 190 }
    }
    await renderer.renderSlidePng({ slide, style: null, regions: [region] })
    expect(surface.jobs[0].scale).toBeCloseTo(1280 / 1920)
    expect(surface.jobs[0].style).toBeNull()
    expect(surface.jobs[0].regions).toEqual([region])
  })

  it('renders a crop of the box plus 10% padding at twice the density', async () => {
    const surface = instantSurface()
    const renderer = new SlideRenderer({ createSurface: () => surface })
    await renderer.renderCropPng({ slide, style, bbox: { x: 1000, y: 300, w: 500, h: 400 } })
    expect(surface.jobs[0].viewport).toEqual({ x: 950, y: 260, w: 600, h: 480 })
    expect(surface.jobs[0].scale).toBeCloseTo((2 * 1280) / 1920)
  })

  it('renders a 480 x 270 thumbnail', async () => {
    const surface = instantSurface()
    const renderer = new SlideRenderer({ createSurface: () => surface })
    await renderer.renderThumbnail({ slide, style })
    const { viewport, scale } = surface.jobs[0]
    expect([viewport.w * scale, viewport.h * scale]).toEqual([480, 270])
  })

  it('sends only the assets the slide uses, as data URLs, and gives each job its own id', async () => {
    const surface = instantSurface()
    const renderer = new SlideRenderer({ createSurface: () => surface })
    const picture: ImageElement = {
      id: 'pic',
      type: 'image',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      fit: 'cover',
      alt: 'x',
      assetId: 'a.png'
    }
    const withPicture = makeSlide('s1', { elements: [picture] })
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
    await renderer.renderSlidePng({
      slide: withPicture,
      style,
      assets: { 'a.png': png, 'unused.png': png }
    })
    await renderer.renderSlidePng({ slide: withPicture, style })
    expect(Object.keys(surface.jobs[0].assets)).toEqual(['a.png'])
    expect(surface.jobs[0].assets['a.png']).toMatch(/^data:image\/png;base64,/)
    expect(surface.jobs[1].assets).toEqual({})
    expect(surface.jobs[0].id).not.toBe(surface.jobs[1].id)
  })

  it('renders an exact part of the slide scaled to fit, with strokes', async () => {
    const surface = instantSurface()
    const renderer = new SlideRenderer({ createSurface: () => surface })
    const strokes: Array<Array<[number, number]>> = [
      [
        [1, 2],
        [30, 40]
      ]
    ]
    await renderer.renderView({
      slide,
      style,
      viewport: { x: 960, y: 540, w: 960, h: 540 },
      width: 480,
      height: 270,
      strokes
    })
    expect(surface.jobs[0].viewport).toEqual({ x: 960, y: 540, w: 960, h: 540 })
    expect(surface.jobs[0].scale).toBeCloseTo(0.5)
    expect(surface.jobs[0].strokes).toEqual(strokes)
    await renderer.renderView({ slide, style, width: 960 })
    expect(surface.jobs[1].viewport).toEqual({ x: 0, y: 0, w: 1920, h: 1080 })
  })

  it('rejects an impossible view without opening a surface', async () => {
    const createSurface = vi.fn(instantSurface)
    const renderer = new SlideRenderer({ createSurface })
    await expect(
      renderer.renderView({ slide, style, viewport: { x: 5000, y: 0, w: 10, h: 10 }, width: 100 })
    ).rejects.toBeInstanceOf(RangeError)
    expect(createSurface).not.toHaveBeenCalled()
  })

  it('rejects (does not throw) for an invalid width and never opens a surface', async () => {
    const createSurface = vi.fn(instantSurface)
    const renderer = new SlideRenderer({ createSurface })
    await expect(renderer.renderSlidePng({ slide, style, width: 0 })).rejects.toBeInstanceOf(
      RangeError
    )
    await expect(renderer.renderSlidePng({ slide, style, width: 99999 })).rejects.toThrow(/width/)
    await expect(renderer.renderSlidePng({ slide, style, width: 100.5 })).rejects.toThrow(/width/)
    await expect(
      renderer.renderCropPng({ slide, style, bbox: { x: 0, y: 0, w: 1, h: 1 }, width: 3 })
    ).rejects.toThrow(/width/)
    expect(createSurface).not.toHaveBeenCalled()
  })
})

describe('SlideRenderer surface lifecycle', () => {
  it('creates the surface on the first job, not at construction, and reuses it', async () => {
    const createSurface = vi.fn(instantSurface)
    const renderer = new SlideRenderer({ createSurface })
    expect(createSurface).not.toHaveBeenCalled()
    await renderer.renderSlidePng({ slide, style })
    await renderer.renderThumbnail({ slide, style })
    await renderer.renderCropPng({ slide, style, bbox: { x: 0, y: 0, w: 200, h: 200 } })
    expect(createSurface).toHaveBeenCalledTimes(1)
  })

  it('runs jobs one at a time, in the order they were asked for', async () => {
    const surface = manualSurface()
    const renderer = new SlideRenderer({ createSurface: () => surface })
    const first = renderer.renderSlidePng({ slide, style })
    const second = renderer.renderThumbnail({ slide, style })
    const third = renderer.renderSlidePng({ slide, style, width: 640 })
    await tick()
    expect(surface.calls).toHaveLength(1)
    surface.calls[0].finish(new Uint8Array([1]))
    await expect(first).resolves.toEqual(new Uint8Array([1]))
    await tick()
    expect(surface.calls).toHaveLength(2)
    surface.calls[1].finish(new Uint8Array([2]))
    await expect(second).resolves.toEqual(new Uint8Array([2]))
    await tick()
    surface.calls[2].finish(new Uint8Array([3]))
    await expect(third).resolves.toEqual(new Uint8Array([3]))
    expect(surface.calls.map((call) => call.job.id)).toEqual(['render-1', 'render-2', 'render-3'])
  })

  it('reports a failed job as a RenderError and carries on with the queue on a fresh surface', async () => {
    const surfaces: Array<ReturnType<typeof manualSurface>> = []
    const renderer = new SlideRenderer({
      createSurface: () => {
        const surface = manualSurface()
        surfaces.push(surface)
        return surface
      }
    })
    const failing = renderer.renderSlidePng({ slide, style })
    const next = renderer.renderThumbnail({ slide, style })
    await tick()
    surfaces[0].calls[0].fail(new Error('the page crashed'))
    await expect(failing).rejects.toMatchObject({
      name: 'RenderError',
      code: 'failed',
      message: expect.stringContaining('the page crashed')
    })
    expect(surfaces[0].disposed).toBe(true)
    await tick()
    expect(surfaces).toHaveLength(2)
    surfaces[1].calls[0].finish()
    await expect(next).resolves.toBe(PNG)
  })

  it('gives up on a job that takes too long and replaces the stuck surface', async () => {
    vi.useFakeTimers()
    const surfaces: Array<ReturnType<typeof manualSurface>> = []
    const renderer = new SlideRenderer({
      timeoutMs: 1000,
      createSurface: () => {
        const surface = manualSurface()
        surfaces.push(surface)
        return surface
      }
    })
    const slow = renderer.renderSlidePng({ slide, style })
    const caught = slow.catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(1000)
    const error = (await caught) as RenderError
    expect(error).toBeInstanceOf(RenderError)
    expect(error.code).toBe('timeout')
    expect(error.message).toContain('1000 ms')
    expect(surfaces[0].disposed).toBe(true)

    const retry = renderer.renderSlidePng({ slide, style })
    await vi.advanceTimersByTimeAsync(0)
    expect(surfaces).toHaveLength(2)
    surfaces[1].calls[0].finish()
    await expect(retry).resolves.toBe(PNG)
  })

  it('does not time out a job that finishes in time', async () => {
    vi.useFakeTimers()
    const surface = manualSurface()
    const renderer = new SlideRenderer({ timeoutMs: 1000, createSurface: () => surface })
    const job = renderer.renderSlidePng({ slide, style })
    await vi.advanceTimersByTimeAsync(900)
    surface.calls[0].finish()
    await expect(job).resolves.toBe(PNG)
    await vi.advanceTimersByTimeAsync(5000)
    expect(surface.disposed).toBe(false)
  })
})

describe('SlideRenderer.dispose', () => {
  it('closes the surface and refuses later jobs', async () => {
    const surface = instantSurface()
    const renderer = new SlideRenderer({ createSurface: () => surface })
    await renderer.renderThumbnail({ slide, style })
    renderer.dispose()
    expect(surface.disposed).toBe(true)
    await expect(renderer.renderThumbnail({ slide, style })).rejects.toMatchObject({
      code: 'disposed'
    })
  })

  it('rejects the job in flight and the ones waiting behind it', async () => {
    const surface = manualSurface()
    const renderer = new SlideRenderer({ createSurface: () => surface })
    const running = renderer.renderSlidePng({ slide, style })
    const waiting = renderer.renderThumbnail({ slide, style })
    await tick()
    renderer.dispose()
    await expect(running).rejects.toMatchObject({ code: 'disposed' })
    await expect(waiting).rejects.toMatchObject({ code: 'disposed' })
    expect(surface.calls).toHaveLength(1)
  })

  it('is safe to call twice and before any job', () => {
    const createSurface = vi.fn(instantSurface)
    const renderer = new SlideRenderer({ createSurface })
    renderer.dispose()
    renderer.dispose()
    expect(createSurface).not.toHaveBeenCalled()
  })
})
