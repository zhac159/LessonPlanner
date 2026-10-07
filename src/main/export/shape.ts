/** Shapes: rectangles, rounded rectangles, ellipses, lines and arrows. */
import type PptxGenJS from 'pptxgenjs'
import { unitsToPt } from '@shared/deck/layout'
import type { Fill, ShapeElement, Stroke } from '@shared/deck/types'
import { hexOf, inchBox, radiusInches, type SlideContext } from './context'

/** PptxGenJS fill for a deck Fill (opacity 0-1 becomes transparency 0-100). */
export function fillProps(ctx: SlideContext, fill: Fill): PptxGenJS.ShapeFillProps {
  const props: PptxGenJS.ShapeFillProps = { color: hexOf(ctx, fill.color) }
  if (fill.opacity !== undefined && fill.opacity < 1) {
    props.transparency = Math.round((1 - Math.max(fill.opacity, 0)) * 100)
  }
  return props
}

function lineProps(ctx: SlideContext, stroke: Stroke): PptxGenJS.ShapeLineProps {
  return {
    color: hexOf(ctx, stroke.color),
    width: Math.max(unitsToPt(stroke.width), 0.25),
    dashType: stroke.dash === 'dash' ? 'dash' : 'solid'
  }
}

/** Adds a shape. `arrow` is a line with an arrowhead at its far end. */
export function addShapeElement(ctx: SlideContext, el: ShapeElement): void {
  const box = inchBox(el)
  const types = ctx.pptx.ShapeType
  const common: PptxGenJS.ShapeProps = { ...box, objectName: el.name ?? el.id, rotate: el.rotation }
  if (el.shape === 'line' || el.shape === 'arrow') {
    const stroke: Stroke = el.stroke ?? { color: 'token:text', width: 6 }
    const line = lineProps(ctx, stroke)
    if (el.shape === 'arrow') line.endArrowType = 'triangle'
    ctx.slide.addShape(types.line, { ...common, line })
    return
  }
  const props: PptxGenJS.ShapeProps = { ...common }
  if (el.fill) props.fill = fillProps(ctx, el.fill)
  if (el.stroke) props.line = lineProps(ctx, el.stroke)
  if (el.shape === 'roundRect') props.rectRadius = radiusInches(el.radius ?? 19, box)
  ctx.slide.addShape(types[el.shape], props)
}
