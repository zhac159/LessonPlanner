/**
 * What the rest of the app may ask of the slide renderer. Services depend on these types, never on
 * Electron or on the SlideRenderer class, so they can be tested with a one-line fake. The lessons service
 * defines the port it needs (`SlideRendererPort`, services/lessons/types.ts); `createSlideRendererPort`
 * adapts a renderer to it.
 */
import type { RenderRegion } from '@shared/annotate/renderJob'
import { polygonBoundingBox } from '@shared/annotate/geometry'
import type { Box, Point } from '@shared/annotate/types'
import { SLIDE_HEIGHT, SLIDE_WIDTH, type Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import type { SlideRendererPort } from '../services/lessons/types'
import { assetIdsUsedBy } from './assets'

/** Width of the annotated full-slide image sent to Claude (16:9, so 1280x720). */
export const DEFAULT_RENDER_WIDTH = 1280
/** Width of Home cards and filmstrip thumbnails (480x270). */
export const THUMBNAIL_WIDTH = 480

export interface RenderSlideOptions {
  slide: Slide
  /** The deck's StyleProfile (`null` = the plain default style). */
  style: StyleProfile | null
  /** Lesson asset bytes by asset id; only the ones the slide uses are sent to the renderer. */
  assets?: Record<string, Uint8Array>
  /** Image width in pixels, 16..4096 (default 1280); the height is 9/16 of it. */
  width?: number
  /** Loops to draw on the slide in the region colour with their numbers. */
  regions?: RenderRegion[]
  /** Free-hand strokes of the Draw tool (open paths in slide units), drawn in the same colour. */
  strokes?: Point[][]
}

export interface RenderCropOptions extends Omit<RenderSlideOptions, 'width'> {
  /** The circled bounding box in slide units; the crop adds 10% padding and is clamped to the slide. */
  bbox: Box
  /** Reference width of a full slide image; the crop has twice its pixel density (default 1280). */
  width?: number
}

export type RenderThumbnailOptions = Pick<RenderSlideOptions, 'slide' | 'style' | 'assets'>

/** An exact part of the slide scaled to fit `width` x `height` (the primitive the others are built on). */
export interface RenderViewOptions extends Omit<RenderSlideOptions, 'width'> {
  /** Part of the slide in slide units (default: the whole slide); clamped to the slide. */
  viewport?: Box
  /** Output size in pixels; the part is scaled to fit inside it, keeping its proportions. */
  width: number
  height?: number
}

/** The one method the lessons adapter needs from a renderer (`SlideRenderer` has it). */
export interface ViewRenderer {
  renderView(options: RenderViewOptions): Promise<Uint8Array>
}

const WHOLE_SLIDE: Box = { x: 0, y: 0, w: SLIDE_WIDTH, h: SLIDE_HEIGHT }

/**
 * Adapts a renderer to the lessons service's port: reads the lesson assets the slide uses through the
 * request's `readAsset`, turns `marks` into numbered loops and `crop` into the viewport. Nothing else of
 * the renderer is exposed to the lessons service.
 */
export function createSlideRendererPort(renderer: ViewRenderer): SlideRendererPort {
  return {
    async renderSlidePng(request) {
      const assets: Record<string, Uint8Array> = {}
      for (const id of assetIdsUsedBy(request.slide)) {
        const bytes = await request.readAsset?.(id)
        if (bytes) assets[id] = bytes
      }
      return renderer.renderView({
        slide: request.slide,
        style: request.style,
        assets,
        viewport: request.crop ?? WHOLE_SLIDE,
        width: request.width,
        height: request.height,
        regions: request.marks?.map((mark) => ({
          n: mark.n,
          path: mark.path,
          bbox: polygonBoundingBox(mark.path)
        })),
        strokes: request.strokes
      })
    }
  }
}
