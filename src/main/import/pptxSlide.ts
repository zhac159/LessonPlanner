/** One `ppt/slides/slideN.xml` → a compact SlideDigest (shapes, boxes in slide units, text runs, fills). */
import type { Box, ParagraphDigest, RunDigest, ShapeDigest, SlideDigest } from './types'
import { readColor, type Theme } from './pptxTheme'
import { attr, child, children, dig, parseXml, textOf, type XmlNode } from './xml'

export interface SlideScale {
  /** Units per EMU on each axis (1920 / slide width, 1080 / slide height). */
  x: number
  y: number
}

const MAX_SHAPES = 60
const MAX_TEXT = 300

const num = (value: string | undefined): number | undefined => {
  const n = value === undefined ? NaN : Number(value)
  return Number.isFinite(n) ? n : undefined
}

function readBox(xfrm: XmlNode | undefined, scale: SlideScale): Box | undefined {
  const x = num(attr(child(xfrm, 'off'), 'x'))
  const y = num(attr(child(xfrm, 'off'), 'y'))
  const w = num(attr(child(xfrm, 'ext'), 'cx'))
  const h = num(attr(child(xfrm, 'ext'), 'cy'))
  if (x === undefined || y === undefined || w === undefined || h === undefined) return undefined
  return {
    x: Math.round(x * scale.x),
    y: Math.round(y * scale.y),
    w: Math.round(w * scale.x),
    h: Math.round(h * scale.y)
  }
}

function readRun(node: XmlNode, theme: Theme): RunDigest | null {
  const text = textOf(node.t).slice(0, MAX_TEXT)
  if (!text) return null
  const props = child(node, 'rPr')
  const run: RunDigest = { text }
  const size = num(attr(props, 'sz'))
  if (size !== undefined) run.sizePt = size / 100
  if (['1', 'true'].includes(attr(props, 'b') ?? '')) run.bold = true
  if (['1', 'true'].includes(attr(props, 'i') ?? '')) run.italic = true
  const color = readColor(child(props, 'solidFill'), theme)
  if (color) run.color = color
  const face = attr(child(props, 'latin'), 'typeface')
  if (face)
    run.font =
      face === '+mj-lt'
        ? (theme.fonts.major ?? face)
        : face === '+mn-lt'
          ? (theme.fonts.minor ?? face)
          : face
  return run
}

function readParagraphs(txBody: XmlNode | undefined, theme: Theme): ParagraphDigest[] {
  const paragraphs: ParagraphDigest[] = []
  for (const p of children(txBody, 'p')) {
    const runs = [...children(p, 'r'), ...children(p, 'fld')]
      .map((r) => readRun(r, theme))
      .filter((r): r is RunDigest => r !== null)
    if (runs.length === 0) continue
    const props = child(p, 'pPr')
    const paragraph: ParagraphDigest = { runs }
    if (child(props, 'buChar') || child(props, 'buAutoNum')) paragraph.bullet = true
    const level = num(attr(props, 'lvl'))
    if (level) paragraph.level = level
    paragraphs.push(paragraph)
  }
  return paragraphs
}

function readShape(node: XmlNode, theme: Theme, scale: SlideScale): ShapeDigest {
  const spPr = child(node, 'spPr')
  const paragraphs = readParagraphs(child(node, 'txBody'), theme)
  const shape: ShapeDigest = { kind: paragraphs.length > 0 ? 'text' : 'shape' }
  const name = attr(dig(node, 'nvSpPr', 'cNvPr'), 'name')
  if (name) shape.name = name
  const ph = dig(node, 'nvSpPr', 'nvPr', 'ph')
  if (ph) shape.placeholder = attr(ph, 'type') ?? 'body'
  const box = readBox(child(spPr, 'xfrm'), scale)
  if (box) shape.box = box
  const geometry = attr(child(spPr, 'prstGeom'), 'prst')
  if (geometry) shape.geometry = geometry
  const fill = readColor(child(spPr, 'solidFill'), theme)
  if (fill) shape.fill = fill
  const line = readColor(dig(spPr, 'ln', 'solidFill'), theme)
  if (line) shape.line = line
  if (paragraphs.length > 0) shape.paragraphs = paragraphs
  return shape
}

function readPicture(node: XmlNode, scale: SlideScale): ShapeDigest {
  const shape: ShapeDigest = { kind: 'picture' }
  const props = dig(node, 'nvPicPr', 'cNvPr')
  const name = attr(props, 'descr') || attr(props, 'name')
  if (name) shape.name = name
  const box = readBox(dig(node, 'spPr', 'xfrm'), scale)
  if (box) shape.box = box
  return shape
}

function readTable(node: XmlNode, theme: Theme, scale: SlideScale): ShapeDigest {
  const shape: ShapeDigest = { kind: 'table' }
  const box = readBox(child(node, 'xfrm'), scale)
  if (box) shape.box = box
  const cells = children(dig(node, 'graphic', 'graphicData', 'tbl'), 'tr').flatMap((row) =>
    children(row, 'tc')
  )
  const paragraphs = cells.flatMap((cell) => readParagraphs(child(cell, 'txBody'), theme))
  if (paragraphs.length > 0) shape.paragraphs = paragraphs
  return shape
}

/** Shapes inside groups are included with their own (group-relative) positions: good enough for style stats. */
function collect(
  tree: XmlNode | undefined,
  theme: Theme,
  scale: SlideScale,
  out: ShapeDigest[]
): void {
  for (const sp of [...children(tree, 'sp'), ...children(tree, 'cxnSp')])
    out.push(readShape(sp, theme, scale))
  for (const pic of children(tree, 'pic')) out.push(readPicture(pic, scale))
  for (const frame of children(tree, 'graphicFrame')) out.push(readTable(frame, theme, scale))
  for (const group of children(tree, 'grpSp')) collect(group, theme, scale, out)
}

/** Parses one slide; throws on malformed XML (the caller records a warning and moves on). */
export function digestSlide(
  xml: string,
  index: number,
  theme: Theme,
  scale: SlideScale
): SlideDigest {
  const shapes: ShapeDigest[] = []
  collect(dig(parseXml(xml), 'sld', 'cSld', 'spTree'), theme, scale, shapes)
  return { index, shapes: shapes.slice(0, MAX_SHAPES) }
}
