/** Pictures and placeholders: shared by image and diagram elements. */
import type { ElementBase, ImageElement } from '@shared/deck/types'
import { fillProps } from './shape'
import { inchBox, noteFont, radiusInches, type InchBox, type SlideContext } from './context'
import { resolveFont } from './fonts'
import { buildRuns } from './text'
import { cleanInline } from './sanitize'
import type { RasterInfo } from './imageInfo'

/** The `image.placeholder` look: tinted rounded box with a centred caption. */
export function addPlaceholder(
  ctx: SlideContext,
  el: ElementBase,
  caption: string,
  styleRef = 'image.placeholder'
): void {
  const component = ctx.style?.components[styleRef]
  const box = inchBox(el)
  ctx.slide.addShape(ctx.pptx.ShapeType.roundRect, {
    ...box,
    objectName: el.name ?? el.id,
    fill: fillProps(ctx, { color: (component?.fill ?? 'token:placeholder') as `token:${string}` }),
    rectRadius: radiusInches(component?.radius ?? 19, box),
    rotate: el.rotation
  })
  const font = noteFont(ctx, resolveFont('caption', ctx.style, styleRef))
  const text = cleanInline(caption)
  if (text === '') return
  const pad = Math.min(0.2, box.w / 8, box.h / 8)
  ctx.slide.addText(buildRuns(ctx, [{ runs: [{ text }] }], font), {
    x: box.x + pad,
    y: box.y + pad,
    w: Math.max(box.w - 2 * pad, 0.1),
    h: Math.max(box.h - 2 * pad, 0.1),
    objectName: `${el.name ?? el.id} caption`,
    margin: 0,
    align: 'center',
    valign: 'middle',
    fit: 'shrink',
    rotate: el.rotation
  })
}

/** Where a picture of the given natural size lands inside the box when fully visible. */
export function containRect(box: InchBox, naturalW: number, naturalH: number): InchBox {
  const scale = Math.min(box.w / naturalW, box.h / naturalH)
  const w = naturalW * scale
  const h = naturalH * scale
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }
}

const toDataUri = (mime: string, bytes: Uint8Array): string =>
  `${mime};base64,${Buffer.from(bytes).toString('base64')}`

/** Embeds a raster picture. `cover` crops to fill the box; `contain` letterboxes inside it. */
export function addPicture(
  ctx: SlideContext,
  el: ElementBase & Pick<ImageElement, 'alt'>,
  bytes: Uint8Array,
  info: RasterInfo,
  fit: 'cover' | 'contain'
): void {
  const box = inchBox(el)
  const common = {
    data: toDataUri(info.mime, bytes),
    objectName: el.name ?? el.id,
    altText: cleanInline(el.alt),
    rotate: el.rotation
  }
  if (fit === 'cover') {
    // PptxGenJS: w/h describe the image's own shape, sizing.w/h the box it is cropped into.
    ctx.slide.addImage({
      ...common,
      x: box.x,
      y: box.y,
      w: info.width / 96,
      h: info.height / 96,
      sizing: { type: 'cover', w: box.w, h: box.h }
    })
    return
  }
  ctx.slide.addImage({ ...common, ...containRect(box, info.width, info.height) })
}
