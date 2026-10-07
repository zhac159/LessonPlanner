/**
 * The contract between the main process and the offscreen render page: one job in, one report out.
 * Pure types and a validator, shared by main (sends), the render preload (checks) and the page (draws).
 */
import { SLIDE_HEIGHT, SLIDE_WIDTH, type Slide } from '../deck/types'
import type { StyleProfile } from '../style/types'
import type { Box, Point, Region } from './types'

/** A circled region as the render page draws it: the loop and its number. */
export type RenderRegion = Pick<Region, 'n' | 'path' | 'bbox'>

/** Pixels per slide unit are limited so a bad call cannot ask for a gigantic window. */
export const MIN_RENDER_SCALE = 0.05
export const MAX_RENDER_SCALE = 4
/** Longest side of an output image in pixels. */
export const MAX_RENDER_PIXELS = 4096

/** Everything the page needs to draw one image. The result is `size` pixels, exactly. */
export interface RenderJob {
  id: string
  slide: Slide
  /** `null` = the plain default style. */
  style: StyleProfile | null
  /** Lesson asset id to `data:` URL, only the assets the slide uses. */
  assets: Record<string, string>
  /** The part of the slide to draw, in slide units (the whole slide, or a crop). */
  viewport: Box
  /** Pixels per slide unit. */
  scale: number
  /** Loops to draw on top, in the region colour with their number. */
  regions: RenderRegion[]
  /** Free-hand strokes of the Draw tool (open paths), drawn in the region colour without a number. */
  strokes: Point[][]
}

/** The page tells main when the job is drawn and settled (fonts loaded, images resolved), or why not. */
export type RenderReport = { id: string; ok: true } | { id: string; ok: false; error: string }

/** The one object the render preload exposes to the page (`window.slideRender`). */
export interface RenderBridge {
  /** Receives render jobs from main. Returns an unsubscribe function. */
  onJob(listener: (job: RenderJob) => void): () => void
  /** Tells main the page is subscribed and ready for jobs. */
  listening(): void
  /** Tells main a job is drawn (or failed). */
  report(report: RenderReport): void
}

/** Output size in whole pixels of a job. */
export function jobPixelSize(job: Pick<RenderJob, 'viewport' | 'scale'>): {
  width: number
  height: number
} {
  return {
    width: Math.max(1, Math.round(job.viewport.w * job.scale)),
    height: Math.max(1, Math.round(job.viewport.h * job.scale))
  }
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPoint = (value: unknown): value is Point =>
  Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber)

const isBox = (value: unknown): value is Box =>
  isRecord(value) && ['x', 'y', 'w', 'h'].every((key) => isFiniteNumber(value[key]))

const isRenderRegion = (value: unknown): value is RenderRegion =>
  isRecord(value) &&
  isFiniteNumber(value.n) &&
  isBox(value.bbox) &&
  Array.isArray(value.path) &&
  value.path.every(isPoint)

/**
 * Structural check of a message received on the job channel. The preload refuses anything that fails
 * it, so the page only ever draws well-formed jobs of a sensible size.
 */
export function isRenderJob(value: unknown): value is RenderJob {
  if (!isRecord(value)) return false
  const { id, slide, style, assets, viewport, scale, regions, strokes } = value
  if (typeof id !== 'string' || id === '') return false
  if (!isRecord(slide) || typeof slide.id !== 'string' || !Array.isArray(slide.elements)) {
    return false
  }
  if (style !== null && !isRecord(style)) return false
  if (!isRecord(assets)) return false
  for (const url of Object.values(assets)) {
    if (typeof url !== 'string' || !url.startsWith('data:image/')) return false
  }
  if (!isBox(viewport) || viewport.w <= 0 || viewport.h <= 0) return false
  if (viewport.x < 0 || viewport.y < 0) return false
  if (viewport.x + viewport.w > SLIDE_WIDTH || viewport.y + viewport.h > SLIDE_HEIGHT) return false
  if (!isFiniteNumber(scale) || scale < MIN_RENDER_SCALE || scale > MAX_RENDER_SCALE) return false
  const { width, height } = jobPixelSize({ viewport, scale })
  if (width > MAX_RENDER_PIXELS || height > MAX_RENDER_PIXELS) return false
  if (
    !Array.isArray(strokes) ||
    !strokes.every((stroke) => Array.isArray(stroke) && stroke.every(isPoint))
  ) {
    return false
  }
  return Array.isArray(regions) && regions.every(isRenderRegion)
}
