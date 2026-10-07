/**
 * SlideRenderer: turns slides into PNG bytes. It owns ONE render surface (in the app, a hidden
 * BrowserWindow, see electronSurface.ts), creates it on first use, reuses it for every job, runs jobs
 * one at a time, and replaces the surface if a job times out or fails. The surface is injected, so the
 * queueing, timeout and disposal rules are unit-tested without Electron.
 */
import type { RenderJob } from '@shared/annotate/renderJob'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@shared/deck/types'
import { assetDataUrls } from './assets'
import { planCrop, planSlide, planView, type RenderPlan } from './plan'
import {
  THUMBNAIL_WIDTH,
  type RenderCropOptions,
  type RenderSlideOptions,
  type RenderThumbnailOptions,
  type RenderViewOptions,
  type ViewRenderer
} from './port'

/** Draws one job and returns its PNG. Implementations load their page lazily on the first job. */
export interface RenderSurface {
  render(job: RenderJob): Promise<Uint8Array>
  /** Releases the window; a render in flight rejects. */
  dispose(): void
}

export type RenderErrorCode = 'timeout' | 'failed' | 'disposed'

/** Why an image could not be rendered. */
export class RenderError extends Error {
  constructor(
    readonly code: RenderErrorCode,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options)
    this.name = 'RenderError'
  }
}

/** The first job also loads the page and the fonts, so the limit is generous. */
export const DEFAULT_RENDER_TIMEOUT_MS = 30_000

export interface SlideRendererOptions {
  /** Makes a surface when the first job arrives (and again after a timeout or failure). */
  createSurface: () => RenderSurface
  timeoutMs?: number
}

export class SlideRenderer implements ViewRenderer {
  private surface: RenderSurface | null = null
  private tail: Promise<unknown> = Promise.resolve()
  private disposed = false
  private counter = 0
  private readonly timeoutMs: number

  constructor(private readonly options: SlideRendererOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS
  }

  /** The slide as a PNG `width` pixels wide (default 1280), optionally with numbered region loops on it. */
  renderSlidePng(options: RenderSlideOptions): Promise<Uint8Array> {
    return this.enqueue(options, () => planSlide(options.width))
  }

  /** A close-up of `bbox` plus 10% padding, at twice the pixel density of a full slide image. */
  renderCropPng(options: RenderCropOptions): Promise<Uint8Array> {
    return this.enqueue(options, () => planCrop(options.bbox, options.width))
  }

  /** A 480x270 picture of the slide for Home cards and the filmstrip. */
  renderThumbnail(options: RenderThumbnailOptions): Promise<Uint8Array> {
    return this.enqueue(options, () => planSlide(THUMBNAIL_WIDTH))
  }

  /** An exact part of the slide (default: all of it) scaled to fit `width` x `height`; what the lessons port uses. */
  renderView(options: RenderViewOptions): Promise<Uint8Array> {
    const viewport = options.viewport ?? { x: 0, y: 0, w: SLIDE_WIDTH, h: SLIDE_HEIGHT }
    return this.enqueue(options, () => planView(viewport, options.width, options.height))
  }

  /** Closes the window and refuses further jobs. Safe to call twice. */
  dispose(): void {
    this.disposed = true
    this.surface?.dispose()
    this.surface = null
  }

  private enqueue(
    options: Pick<RenderSlideOptions, 'slide' | 'style' | 'assets' | 'regions' | 'strokes'>,
    makePlan: () => RenderPlan
  ): Promise<Uint8Array> {
    let plan: RenderPlan
    try {
      plan = makePlan()
    } catch (error) {
      return Promise.reject(error)
    }
    this.counter += 1
    const job: RenderJob = {
      id: `render-${this.counter}`,
      slide: options.slide,
      style: options.style,
      assets: assetDataUrls(options.slide, options.assets),
      viewport: plan.viewport,
      scale: plan.scale,
      regions: options.regions ?? [],
      strokes: options.strokes ?? []
    }
    const result = this.tail.then(() => this.run(job))
    this.tail = result.catch(() => undefined)
    return result
  }

  private async run(job: RenderJob): Promise<Uint8Array> {
    if (this.disposed) throw new RenderError('disposed', 'The slide renderer has been shut down')
    const surface = (this.surface ??= this.options.createSurface())
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new RenderError('timeout', `Rendering took longer than ${this.timeoutMs} ms`)),
        this.timeoutMs
      )
    })
    try {
      return await Promise.race([surface.render(job), timeout])
    } catch (error) {
      // A stuck or broken window must not poison the next job: drop it, the next job makes a new one.
      if (this.surface === surface) this.surface = null
      surface.dispose()
      if (error instanceof RenderError) throw error
      const reason = error instanceof Error ? error.message : String(error)
      throw new RenderError(
        this.disposed ? 'disposed' : 'failed',
        this.disposed ? 'The slide renderer has been shut down' : `Rendering failed: ${reason}`,
        { cause: error }
      )
    } finally {
      clearTimeout(timer)
    }
  }
}
