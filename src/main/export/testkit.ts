/**
 * Test-only helpers: open an exported .pptx with JSZip and read the shapes back, so tests can
 * assert on what PowerPoint will see (positions, colours, text) instead of on our own code.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import JSZip from 'jszip'
import type { Deck, Element, Slide } from '@shared/deck/types'
import { exportDeckToPptx, type ExportIo } from './pptx'
import type { StyleProfile } from '@shared/style/types'
import { rasteriseSvg } from './rasterise'

const EMU_PER_UNIT = 6350
const ARRAY_TAGS = new Set(['p:sp', 'p:pic', 'p:graphicFrame', 'a:p', 'a:r', 'a:gridCol', 'a:tr'])
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  trimValues: false,
  parseTagValue: false,
  isArray: (name) => ARRAY_TAGS.has(name)
})

/** `any`-free loose tree for walking parsed XML. */
type Node = { [key: string]: unknown }
const node = (v: unknown): Node => (v && typeof v === 'object' ? (v as Node) : {})
const list = (v: unknown): Node[] => (Array.isArray(v) ? v.map(node) : v ? [node(v)] : [])

/** A run of text as PowerPoint stores it. */
export interface RunInfo {
  text: string
  color?: string
  bold: boolean
  sizePt?: number
  font?: string
}

/** One drawable thing on a slide, in slide units. */
export interface ShapeInfo {
  kind: 'shape' | 'picture' | 'table'
  name: string
  x: number
  y: number
  w: number
  h: number
  geometry?: string
  fill?: string
  text: string
  paragraphs: RunInfo[][]
  rotation?: number
}

/** An opened .pptx. */
export interface OpenedPptx {
  zip: JSZip
  names: string[]
  /** Raw XML (or other text) for every part. */
  text(name: string): Promise<string>
  slideShapes(slideNumber: number): Promise<ShapeInfo[]>
  slideCount: number
}

function colorOf(holder: unknown): string | undefined {
  const fill = node(node(holder)['a:solidFill'])
  const clr = node(fill['a:srgbClr'])
  return typeof clr['@val'] === 'string' ? (clr['@val'] as string) : undefined
}

function readParagraphs(txBody: unknown): RunInfo[][] {
  return list(node(txBody)['a:p']).map((p) =>
    list(p['a:r']).map((r) => {
      const props = node(r['a:rPr'])
      const sz = props['@sz']
      return {
        text: String(node(r)['a:t'] ?? ''),
        color: colorOf(props),
        bold: props['@b'] === '1' || props['@b'] === 1,
        sizePt: sz === undefined ? undefined : Number(sz) / 100,
        font: node(props['a:latin'])['@typeface'] as string | undefined
      }
    })
  )
}

function readXfrm(xfrm: Node): Pick<ShapeInfo, 'x' | 'y' | 'w' | 'h'> {
  const off = node(xfrm['a:off'])
  const ext = node(xfrm['a:ext'])
  const u = (v: unknown): number => Number(v) / EMU_PER_UNIT
  return { x: u(off['@x']), y: u(off['@y']), w: u(ext['@cx']), h: u(ext['@cy']) }
}

function toShape(kind: ShapeInfo['kind'], el: Node): ShapeInfo {
  const nv = node(node(el['p:nvSpPr'] ?? el['p:nvPicPr'] ?? el['p:nvGraphicFramePr'])['p:cNvPr'])
  const spPr = node(el['p:spPr'])
  const xfrm = node(spPr['a:xfrm'] ?? el['p:xfrm'])
  const paragraphs = readParagraphs(el['p:txBody'])
  const rot = node(xfrm)['@rot']
  return {
    kind,
    name: String(nv['@name'] ?? ''),
    ...readXfrm(xfrm),
    geometry: node(spPr['a:prstGeom'])['@prst'] as string | undefined,
    fill: colorOf(spPr),
    text: paragraphs.map((p) => p.map((r) => r.text).join('')).join('\n'),
    paragraphs,
    rotation: rot === undefined ? undefined : Number(rot) / 60000
  }
}

/** Validates every XML part (throws on the first malformed one) and returns a reader. */
export async function openPptx(bytes: Uint8Array): Promise<OpenedPptx> {
  const zip = await JSZip.loadAsync(bytes)
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir)
  for (const name of names.filter((n) => /\.(xml|rels)$/.test(n))) {
    const valid = XMLValidator.validate(await zip.files[name].async('string'))
    if (valid !== true) throw new Error(`${name}: ${valid.err.msg}`)
  }
  const text = (name: string): Promise<string> => {
    const file = zip.file(name)
    if (!file) throw new Error(`missing part ${name}`)
    return file.async('string')
  }
  const slideCount = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length
  return {
    zip,
    names,
    text,
    slideCount,
    async slideShapes(n) {
      const tree = node(node(parser.parse(await text(`ppt/slides/slide${n}.xml`)))['p:sld'])
      const spTree = node(node(node(tree['p:cSld'])['p:spTree']))
      // Document order is lost across tag groups; sort by name suffix is not needed for tests.
      return [
        ...list(spTree['p:sp']).map((e) => toShape('shape', e)),
        ...list(spTree['p:pic']).map((e) => toShape('picture', e)),
        ...list(spTree['p:graphicFrame']).map((e) => toShape('table', e))
      ]
    }
  }
}

const FIXTURES = join(process.cwd(), 'design', 'fixtures')

/** The photosynthesis deck from the design folder, optionally with extra elements on slide 1. */
export function loadFixtureDeck(): Deck {
  return JSON.parse(readFileSync(join(FIXTURES, 'deck.photosynthesis.json'), 'utf8')) as Deck
}

/** The Science KS3 style profile from the design folder. */
export function loadFixtureStyle(): StyleProfile {
  return JSON.parse(readFileSync(join(FIXTURES, 'style-profile.science-ks3.json'), 'utf8'))
}

/** A real PNG of the given size and colour (rendered with resvg, so it is always valid). */
export async function makePng(
  width: number,
  height: number,
  color = '#3366cc'
): Promise<Uint8Array> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${color}"/></svg>`
  return rasteriseSvg(svg, width)
}

/** A one-slide deck around the given elements (no style profile needed). */
export function deckWith(
  elements: Element[],
  slide: Partial<Slide> = {},
  title = 'Test lesson'
): Deck {
  const base = loadFixtureDeck()
  return {
    ...base,
    title,
    styleId: null,
    styleVersion: null,
    slides: [{ id: 's1', kind: 'content', elements, ...slide }]
  }
}

/** A plain text element covering a box; handy for placing and parsing back. */
export function textEl(id: string, text: string, extra: Partial<Element> = {}): Element {
  return {
    id,
    type: 'text',
    role: 'body',
    x: 100,
    y: 100,
    w: 600,
    h: 100,
    paragraphs: [{ runs: [{ text }] }],
    ...extra
  } as Element
}

/** An io that has no assets and uses the default rasteriser. */
export const NO_ASSETS: ExportIo = { readAsset: async () => undefined }

/** Exports a one-slide deck and opens slide 1: the workhorse of the element tests. */
export async function exportOne(elements: Element[], io: ExportIo = NO_ASSETS, withStyle = true) {
  const { bytes, warnings } = await exportDeckToPptx(
    deckWith(elements),
    withStyle ? loadFixtureStyle() : null,
    io
  )
  const file = await openPptx(bytes)
  return { file, warnings, shapes: await file.slideShapes(1) }
}

/** Finds a shape by the name the exporter gives it (the element's name or id). */
export const named = (shapes: ShapeInfo[], name: string): ShapeInfo =>
  shapes.find((s) => s.name === name)!
