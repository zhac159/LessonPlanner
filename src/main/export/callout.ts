/** Callouts: a filled rounded box with an optional bold label followed by the text; the speech bubble has a tail. */
import type PptxGenJS from 'pptxgenjs'
import { readableOn } from '@shared/deck/colorGuards'
import { unitsToInches, unitsToPt } from '@shared/deck/layout'
import {
  BUBBLE_RADIUS,
  BUBBLE_STROKE,
  resolveTail,
  speechBubbleShape
} from '@shared/deck/speechBubble'
import type { CalloutElement, ColorValue, Run } from '@shared/deck/types'
import { hexOf, inchBox, noteFont, radiusInches, type SlideContext } from './context'
import { resolveFont } from './fonts'
import { cleanInline } from './sanitize'
import { fillProps } from './shape'
import { buildRuns } from './text'

const DEFAULT_PADDING: [number, number] = [31, 38]
const DEFAULT_RADIUS = 19

/** Adds the box, then a text frame inset by the component's padding with the label run first. */
export function addCalloutElement(ctx: SlideContext, el: CalloutElement): void {
  const styleRef = el.styleRef ?? `callout.${el.variant}`
  const component = ctx.style?.components[styleRef]
  const font = noteFont(ctx, resolveFont('callout', ctx.style, styleRef))
  const box = inchBox(el)
  const [padY, padX] = component?.padding ?? DEFAULT_PADDING
  const bubble = el.variant === 'speech-bubble'
  const fill = (component?.fill ?? (bubble ? 'token:chipBg' : 'token:highlight')) as ColorValue
  // A speech bubble keeps its text readable on its fill (white text on a white bubble would vanish).
  if (bubble) {
    font.color = readableOn(`#${hexOf(ctx, fill)}`, [`#${hexOf(ctx, font.color)}`]) as ColorValue
  }
  if (bubble) addBubbleShape(ctx, el, fill, component?.radius)
  else {
    ctx.slide.addShape(ctx.pptx.ShapeType.roundRect, {
      ...box,
      objectName: el.name ?? el.id,
      fill: fillProps(ctx, { color: fill }),
      rectRadius: radiusInches(component?.radius ?? DEFAULT_RADIUS, box),
      rotate: el.rotation
    })
  }

  const label: Run[] = el.label ? [{ text: `${cleanInline(el.label)} `, bold: true }] : []
  const inset = { x: unitsToInches(padX), y: unitsToInches(padY) }
  ctx.slide.addText(buildRuns(ctx, el.paragraphs, font, label), {
    x: box.x + inset.x,
    y: box.y + inset.y,
    w: Math.max(box.w - 2 * inset.x, 0.1),
    h: Math.max(box.h - 2 * inset.y, 0.1),
    objectName: `${el.name ?? el.id} text`,
    margin: 0,
    valign: 'middle',
    fit: 'shrink',
    rotate: el.rotation
  })
}

/**
 * The wedge speech bubble as a freeform shape (PowerPoint's own callout presets cannot be steered by a tail hint
 * through PptxGenJS): the same path as the on-screen renderer. The frame grows to hold the tail; the text frame
 * stays on the body.
 */
function addBubbleShape(
  ctx: SlideContext,
  el: CalloutElement,
  fill: ColorValue,
  radius: number | undefined
): void {
  const { path, bounds } = speechBubbleShape(el.w, el.h, radius ?? BUBBLE_RADIUS, resolveTail(el))
  const at = (x: number, y: number) => ({
    x: unitsToInches(x - bounds.minX),
    y: unitsToInches(y - bounds.minY)
  })
  const points: PptxGenJS.ShapeProps['points'] = path.map((seg) => {
    if (seg.op === 'Z') return { close: true }
    if (seg.op === 'M') return { ...at(seg.x, seg.y), moveTo: true }
    if (seg.op === 'L') return at(seg.x, seg.y)
    return {
      ...at(seg.x, seg.y),
      curve: { type: 'quadratic', x1: at(seg.cx, seg.cy).x, y1: at(seg.cx, seg.cy).y }
    }
  })
  const frame = inchBox({
    x: el.x + bounds.minX,
    y: el.y + bounds.minY,
    w: bounds.maxX - bounds.minX,
    h: bounds.maxY - bounds.minY
  })
  ctx.slide.addShape('custGeom' as PptxGenJS.ShapeType, {
    ...frame,
    points,
    objectName: el.name ?? el.id,
    fill: fillProps(ctx, { color: fill }),
    line: { color: hexOf(ctx, 'token:text'), width: unitsToPt(BUBBLE_STROKE) },
    rotate: el.rotation
  })
}
