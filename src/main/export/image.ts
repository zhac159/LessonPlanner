/** Image and diagram elements. Anything that cannot be embedded becomes a labelled placeholder. */
import { spotInfo } from '@shared/assets/spots'
import type { DiagramElement, ImageElement } from '@shared/deck/types'
import { slideWarn, type SlideContext } from './context'
import { sniffImage, type RasterInfo } from './imageInfo'
import { addPicture, addPlaceholder } from './picture'

/** Diagrams are rasterised at twice their slide width (1 unit = 1 px at 1920 wide). */
const DIAGRAM_SCALE = 2

interface Raster {
  bytes: Uint8Array
  info: RasterInfo
}

/** Rasterises SVG to a PNG; `undefined` when the renderer fails or yields something unusable. */
async function rasterise(
  ctx: SlideContext,
  svg: string,
  widthUnits: number
): Promise<Raster | undefined> {
  try {
    const bytes = await ctx.io.rasteriseSvg(svg, Math.round(widthUnits * DIAGRAM_SCALE))
    const info = sniffImage(bytes)
    return info?.kind === 'raster' ? { bytes, info } : undefined
  } catch {
    return undefined
  }
}

/** Turns asset bytes (PNG, JPEG, GIF or SVG) into something embeddable. */
async function toRaster(
  ctx: SlideContext,
  bytes: Uint8Array,
  widthUnits: number
): Promise<Raster | undefined> {
  const info = sniffImage(bytes)
  if (info?.kind === 'raster') return { bytes, info }
  if (info?.kind === 'svg') return rasterise(ctx, info.text, widthUnits)
  return undefined
}

/**
 * Adds an image from the lesson's assets. A picture spot (no picture yet) is skipped: no shape, no caption, a
 * warning and an entry in the report. The tinted box with a caption stays only for a picture whose file cannot be
 * read or used (agents/ASSETS.md §6).
 */
export async function addImageElement(ctx: SlideContext, el: ImageElement): Promise<void> {
  if (!el.assetId) {
    const description = el.placeholder ? spotInfo(el).description : el.alt
    if (el.placeholder) ctx.report.skippedSpots.push({ slide: ctx.slideNumber, description })
    const what = el.placeholder ? 'the empty picture spot' : 'the empty picture'
    slideWarn(ctx, description ? `${what} “${description}” was left out.` : `${what} was left out.`)
    return
  }
  const label = el.alt || el.assetId
  const caption = el.alt || el.placeholder?.description || ''
  const bytes = await ctx.io.readAsset(el.assetId)
  if (!bytes) {
    ctx.report.missingAssets.push(label)
    slideWarn(ctx, `the picture “${label}” could not be found, so a placeholder was used.`)
    addPlaceholder(ctx, el, caption)
    return
  }
  const raster = await toRaster(ctx, bytes, el.w)
  if (!raster) {
    ctx.report.missingAssets.push(label)
    slideWarn(
      ctx,
      `the picture “${label}” is not a PNG, JPEG, GIF or SVG, so a placeholder was used.`
    )
    addPlaceholder(ctx, el, caption)
    return
  }
  addPicture(ctx, el, raster.bytes, raster.info, el.fit)
}

/** Rasterises the diagram's SVG at 2x and embeds the PNG (PowerPoint cannot edit it, by design). */
export async function addDiagramElement(ctx: SlideContext, el: DiagramElement): Promise<void> {
  const raster = await rasterise(ctx, el.svg, el.w)
  if (!raster) {
    slideWarn(ctx, `the diagram “${el.alt}” could not be drawn, so a placeholder was used.`)
    addPlaceholder(ctx, el, el.alt)
    return
  }
  addPicture(ctx, el, raster.bytes, raster.info, 'contain')
}
