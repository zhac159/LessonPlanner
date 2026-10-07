/**
 * Pictures of a .pptx: every `p:pic`, picture fill and background image on the slides, plus pictures that live on
 * the layouts and masters (a logo placed once on the master shows on every slide). Media bytes are passed through
 * exactly as stored in ppt/media; positions are converted from EMU to the 1920x1080 grid.
 */
import { posix } from 'node:path'
import JSZip from 'jszip'
import { ImportError } from '../errors'
import { attr, child, children, dig, parseXml, textOf, type XmlNode } from '../xml'
import { decodeImage, mimeFromName, sniffMime } from './decode'
import { isUnsafeFileError } from './limits'
import { EntryTooLarge, zipReader, type ZipReader } from './zipRead'
import { finalise, prepareImage, type Draft, type Placement, type Prepared } from './finalize'
import { nearbyText, slideTextOf, type TextItem } from './nearText'
import type { Box, CropRect, ExtractOptions, ExtractionResult, ImageMime } from './types'

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const DEFAULT_EMU = { cx: 12_192_000, cy: 6_858_000 }
const GENERIC_NAME =
  /^(picture|image|img|graphic|content placeholder|object|group|preencoded|dsc|screenshot|photo)[ _.-]*\d*$/i

interface Affine {
  sx: number
  sy: number
  ox: number
  oy: number
}

const num = (value: string | undefined): number | undefined => {
  const n = value === undefined ? NaN : Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** An opened deck: the zip directory plus a reader that caps every inflate (see zipRead.ts). */
interface Pkg {
  zip: JSZip
  read: ZipReader
}

async function openZip(bytes: Uint8Array, limits: ExtractOptions['zipLimits']): Promise<Pkg> {
  if (OLE_MAGIC.every((byte, i) => bytes[i] === byte)) throw new ImportError('password')
  try {
    const zip = await JSZip.loadAsync(bytes)
    return { zip, read: zipReader(zip, limits) }
  } catch {
    throw new ImportError('corrupt')
  }
}

const readText = (pkg: Pkg, path: string): Promise<string | undefined> => pkg.read.text(path)

/** `ppt/slides/_rels/slide1.xml.rels` style lookup: relationship id -> {type, resolved part path}. */
async function readRels(pkg: Pkg, part: string) {
  const relsPath = posix.join(posix.dirname(part), '_rels', `${posix.basename(part)}.rels`)
  const xml = await readText(pkg, relsPath)
  const map = new Map<string, { type: string; target: string; external: boolean }>()
  if (!xml) return map
  for (const rel of children(dig(parseXml(xml), 'Relationships'), 'Relationship')) {
    const id = attr(rel, 'Id')
    const target = attr(rel, 'Target')
    if (!id || !target) continue
    const external = attr(rel, 'TargetMode') === 'External'
    const resolved = target.startsWith('/')
      ? target.slice(1)
      : posix.normalize(posix.join(posix.dirname(part), target))
    map.set(id, { type: attr(rel, 'Type') ?? '', target: resolved, external })
  }
  return map
}

async function slidePaths(pkg: Pkg, presentation: XmlNode): Promise<string[]> {
  const { zip } = pkg
  const byName = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(/\d+/.exec(a.slice(11))?.[0]) - Number(/\d+/.exec(b.slice(11))?.[0]))
  try {
    const rels = await readRels(pkg, 'ppt/presentation.xml')
    const ordered = children(dig(presentation, 'presentation', 'sldIdLst'), 'sldId')
      .map((id) => rels.get(attr(id, 'id') ?? '')?.target)
      .filter((target): target is string => Boolean(target) && zip.file(target as string) !== null)
    return ordered.length > 0 ? ordered : byName
  } catch (error) {
    if (isUnsafeFileError(error)) throw error
    return byName
  }
}

interface Xfrm {
  box: Box
  rotation: number
  flipH: boolean
}

/** Position of a shape on the slide grid, through the group transforms; undefined when it inherits it. */
function readXfrm(
  xfrm: XmlNode | undefined,
  a: Affine,
  scale: { x: number; y: number }
): Xfrm | undefined {
  const x = num(attr(child(xfrm, 'off'), 'x'))
  const y = num(attr(child(xfrm, 'off'), 'y'))
  const cx = num(attr(child(xfrm, 'ext'), 'cx'))
  const cy = num(attr(child(xfrm, 'ext'), 'cy'))
  if (x === undefined || y === undefined || cx === undefined || cy === undefined) return undefined
  const rotation = ((((num(attr(xfrm, 'rot')) ?? 0) / 60000) % 360) + 360) % 360
  let w = cx * a.sx * scale.x
  let h = cy * a.sy * scale.y
  const centerX = (a.ox + x * a.sx) * scale.x + w / 2
  const centerY = (a.oy + y * a.sy) * scale.y + h / 2
  if (rotation !== 0) {
    const rad = (rotation * Math.PI) / 180
    const bw = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))
    const bh = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad))
    w = bw
    h = bh
  }
  return {
    box: {
      x: Math.round(centerX - w / 2),
      y: Math.round(centerY - h / 2),
      w: Math.round(w),
      h: Math.round(h)
    },
    rotation: Math.round(rotation * 10) / 10,
    flipH: attr(xfrm, 'flipH') === '1'
  }
}

/** The affine map child-space -> slide EMU for the children of a group. */
function groupAffine(group: XmlNode, parent: Affine): Affine {
  const xfrm = dig(group, 'grpSpPr', 'xfrm')
  const offX = num(attr(child(xfrm, 'off'), 'x'))
  const offY = num(attr(child(xfrm, 'off'), 'y'))
  const extX = num(attr(child(xfrm, 'ext'), 'cx'))
  const extY = num(attr(child(xfrm, 'ext'), 'cy'))
  const chOffX = num(attr(child(xfrm, 'chOff'), 'x'))
  const chOffY = num(attr(child(xfrm, 'chOff'), 'y'))
  const chExtX = num(attr(child(xfrm, 'chExt'), 'cx'))
  const chExtY = num(attr(child(xfrm, 'chExt'), 'cy'))
  if (
    offX === undefined ||
    offY === undefined ||
    extX === undefined ||
    extY === undefined ||
    chOffX === undefined ||
    chOffY === undefined ||
    !chExtX ||
    !chExtY
  )
    return parent
  const gx = extX / chExtX
  const gy = extY / chExtY
  return {
    sx: parent.sx * gx,
    sy: parent.sy * gy,
    ox: parent.ox + parent.sx * (offX - chOffX * gx),
    oy: parent.oy + parent.sy * (offY - chOffY * gy)
  }
}

function readCrop(blipFill: XmlNode | undefined): CropRect | undefined {
  const rect = child(blipFill, 'srcRect')
  if (!rect) return undefined
  const part = (key: string) => Math.max(0, Math.min(0.95, (num(attr(rect, key)) ?? 0) / 100000))
  const crop = { l: part('l'), t: part('t'), r: part('r'), b: part('b') }
  return crop.l || crop.t || crop.r || crop.b ? crop : undefined
}

interface Found {
  embed: string
  placement: Omit<Placement, 'pageOrSlide' | 'nearbyText' | 'slideText' | 'usedOn'>
  /** True when the picture's own position is inherited from the layout (placeholder without xfrm). */
  inherited: boolean
}

interface Collected {
  pictures: Found[]
  texts: TextItem[]
}

/** Alt text if it says something; file names and "Picture 3" style names do not. */
function altOf(props: XmlNode | undefined): string | undefined {
  for (const raw of [attr(props, 'descr'), attr(props, 'name')]) {
    const text = raw?.trim().replace(/.(png|jpe?g|gif|bmp|webp|svg|emf|wmf|tiff?)$/i, '')
    if (text && !GENERIC_NAME.test(text)) return text
  }
  return undefined
}

function paragraphsOf(node: XmlNode | undefined): string[] {
  return children(child(node, 'txBody'), 'p')
    .map((p) =>
      [...children(p, 'r'), ...children(p, 'fld')]
        .map((run) => textOf(run.t))
        .join('')
        .trim()
    )
    .filter(Boolean)
}

/** Walks a shape tree (slide, layout or master) and collects its pictures and text. */
function walk(
  tree: XmlNode | undefined,
  affine: Affine,
  scale: { x: number; y: number },
  origin: 'slide' | 'layout' | 'master',
  out: Collected
): void {
  for (const pic of children(tree, 'pic')) {
    const blipFill = child(pic, 'blipFill')
    const embed = attr(child(blipFill, 'blip'), 'embed')
    if (!embed) continue
    const placeholder = Boolean(dig(pic, 'nvPicPr', 'nvPr', 'ph'))
    // Placeholders on layouts and masters are empty slots, not pictures of their own.
    if (placeholder && origin !== 'slide') continue
    const xfrm = readXfrm(dig(pic, 'spPr', 'xfrm'), affine, scale)
    out.pictures.push({
      embed,
      inherited: !xfrm,
      placement: {
        origin,
        box: xfrm?.box ?? { x: 0, y: 0, w: 0, h: 0 },
        rotation: xfrm?.rotation ?? 0,
        crop: readCrop(blipFill),
        altText: altOf(dig(pic, 'nvPicPr', 'cNvPr'))
      }
    })
  }
  for (const sp of children(tree, 'sp')) {
    const xfrm = readXfrm(dig(sp, 'spPr', 'xfrm'), affine, scale)
    const fill = dig(sp, 'spPr', 'blipFill')
    const embed = attr(child(fill, 'blip'), 'embed')
    if (embed && xfrm && origin === 'slide') {
      out.pictures.push({
        embed,
        inherited: false,
        placement: {
          origin: 'fill',
          box: xfrm.box,
          rotation: xfrm.rotation,
          crop: readCrop(fill),
          altText: altOf(dig(sp, 'nvSpPr', 'cNvPr'))
        }
      })
    }
    if (origin === 'slide') {
      for (const text of paragraphsOf(sp)) {
        out.texts.push({ text, box: xfrm?.box ?? { x: -1e6, y: -1e6, w: 0, h: 0 } })
      }
    }
  }
  for (const group of children(tree, 'grpSp'))
    walk(group, groupAffine(group, affine), scale, origin, out)
}

interface SharedPart {
  origin: 'layout' | 'master'
  collected: Collected
  slides: number[]
  /** For a layout: the master above it. */
  parent?: string
}

export async function extractFromPptx(
  fileName: string,
  bytes: Uint8Array,
  options: Required<Pick<ExtractOptions, 'maxImages' | 'maxUnits' | 'maxPixels'>> & ExtractOptions
): Promise<ExtractionResult> {
  const zip = await openZip(bytes, options.zipLimits)
  const presentationXml = await readText(zip, 'ppt/presentation.xml')
  if (!presentationXml) throw new ImportError('corrupt')
  let presentation: XmlNode
  try {
    presentation = parseXml(presentationXml)
  } catch {
    throw new ImportError('corrupt')
  }
  const size = dig(presentation, 'presentation', 'sldSz')
  const cx = num(attr(size, 'cx')) || DEFAULT_EMU.cx
  const cy = num(attr(size, 'cy')) || DEFAULT_EMU.cy
  const scale = { x: 1920 / cx, y: 1080 / cy }
  const paths = await slidePaths(zip, presentation)
  if (paths.length === 0) throw new ImportError('empty')

  const decode = options.decode ?? decodeImage
  const warnings: string[] = []
  const media = new Map<string, Prepared | null>()
  const loadMedia = async (path: string): Promise<Prepared | null> => {
    if (media.has(path)) return media.get(path) ?? null
    let prepared: Prepared | null = null
    try {
      const data = await zip.read.bytes(path)
      const mime: ImageMime | undefined = data && (sniffMime(data) ?? mimeFromName(path))
      if (data && mime)
        prepared = await prepareImage(data, mime, { decode, maxPixels: options.maxPixels })
    } catch (error) {
      // One picture over its own cap is skipped with a note; running out of the deck's total stops the read.
      if (!(error instanceof EntryTooLarge)) throw error
      warnings.push('A picture was skipped: it is too large to read safely')
    }
    media.set(path, prepared)
    return prepared
  }

  const units = Math.min(paths.length, options.maxUnits)
  if (paths.length > units)
    warnings.push(`Only the first ${units} of ${paths.length} slides were read`)
  const drafts: Draft[] = []
  const counter = new Map<string, number>()
  const nextId = (tag: string): string => {
    const n = (counter.get(tag) ?? 0) + 1
    counter.set(tag, n)
    return `${fileName}#${tag}.${n}`
  }
  // layout / master pictures are collected once and shared by the slides that use them
  const shared = new Map<string, SharedPart>()
  const identity: Affine = { sx: 1, sy: 1, ox: 0, oy: 0 }
  let capped = false

  /** Reads a layout (and the master above it) once; returns its record. */
  const loadShared = async (part: string, origin: 'layout' | 'master'): Promise<SharedPart> => {
    const known = shared.get(part)
    if (known) return known
    const entry: SharedPart = { origin, collected: { pictures: [], texts: [] }, slides: [] }
    shared.set(part, entry)
    const xml = await readText(zip, part)
    if (xml) {
      const root = origin === 'layout' ? 'sldLayout' : 'sldMaster'
      walk(dig(parseXml(xml), root, 'cSld', 'spTree'), identity, scale, origin, entry.collected)
    }
    if (origin === 'layout') {
      const parent = [...(await readRels(zip, part)).values()].find((r) =>
        r.type.endsWith('/slideMaster')
      )
      if (parent) {
        await loadShared(parent.target, 'master')
        entry.parent = parent.target
      }
    }
    return entry
  }

  const addDraft = async (
    id: string,
    embed: string,
    rels: Awaited<ReturnType<typeof readRels>>,
    placement: Placement
  ) => {
    if (drafts.length >= options.maxImages) {
      capped = true
      return
    }
    const rel = rels.get(embed)
    if (!rel || rel.external) {
      warnings.push(
        `Slide ${placement.pageOrSlide}: a linked picture was skipped (it is not inside the file)`
      )
      return
    }
    const prepared = await loadMedia(rel.target)
    if (!prepared) return
    drafts.push({ id, prepared, placement })
  }

  for (let index = 0; index < units; index++) {
    if (options.signal?.aborted) break
    const slideNo = index + 1
    const part = paths[index]
    try {
      const xml = await readText(zip, part)
      if (!xml) continue
      const slide = parseXml(xml)
      const rels = await readRels(zip, part)
      const cSld = dig(slide, 'sld', 'cSld')
      const collected: Collected = { pictures: [], texts: [] }
      walk(dig(cSld, 'spTree'), identity, scale, 'slide', collected)

      // background picture
      const bgEmbed = attr(child(dig(cSld, 'bg', 'bgPr', 'blipFill'), 'blip') ?? undefined, 'embed')
      if (bgEmbed) {
        collected.pictures.push({
          embed: bgEmbed,
          inherited: false,
          placement: { origin: 'background', box: { x: 0, y: 0, w: 1920, h: 1080 }, rotation: 0 }
        })
      }

      // layout and master (collected once, credited to every slide that uses them)
      const layoutRel = [...rels.values()].find((r) => r.type.endsWith('/slideLayout'))
      if (layoutRel) {
        const layout = await loadShared(layoutRel.target, 'layout')
        layout.slides.push(slideNo)
        if (layout.parent) shared.get(layout.parent)?.slides.push(slideNo)
      }

      const slideText = slideTextOf(collected.texts)
      for (const found of collected.pictures) {
        let { box } = found.placement
        if (found.inherited) {
          // A picture placeholder without its own position: nothing reliable to say, use the slide.
          box = { x: 0, y: 0, w: 0, h: 0 }
        }
        const placement: Placement = {
          ...found.placement,
          box,
          pageOrSlide: slideNo,
          nearbyText: nearbyText(collected.texts, box),
          slideText
        }
        await addDraft(nextId(`s${slideNo}`), found.embed, rels, placement)
      }
    } catch (error) {
      if (isUnsafeFileError(error)) throw error
      warnings.push(`Slide ${slideNo} could not be read`)
    }
    options.onProgress?.({ done: slideNo, total: units })
  }

  // Layout and master pictures: one record each, shown on every slide that uses them.
  for (const [part, entry] of shared) {
    if (entry.slides.length === 0 || entry.collected.pictures.length === 0) continue
    const rels = await readRels(zip, part)
    const slides = [...new Set(entry.slides)].sort((a, b) => a - b)
    for (const found of entry.collected.pictures) {
      await addDraft(nextId(`${entry.origin}${slides[0]}`), found.embed, rels, {
        ...found.placement,
        pageOrSlide: slides[0],
        nearbyText: '',
        slideText: '',
        usedOn: slides
      })
    }
  }
  if (capped) warnings.push(`Stopped after ${options.maxImages} pictures`)

  const images = finalise(drafts, { fileName, sourceKind: 'pptx', units: paths.length })
  return { fileName, sourceKind: 'pptx', units: paths.length, images, scanned: false, warnings }
}
