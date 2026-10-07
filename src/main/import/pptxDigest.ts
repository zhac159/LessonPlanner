/**
 * `.pptx` → PptxDigest, locally and without AI (design/style-profile.md §2.2): theme colours and fonts,
 * per-slide shapes in 1920×1080 units, text runs, pictures, plus colour/font/size frequencies.
 * Robust by design: missing or broken parts become warnings; only "not a deck" or "no slides" throw.
 */
import JSZip from 'jszip'
import { ImportError } from './errors'
import { digestSlide, type SlideScale } from './pptxSlide'
import { EMPTY_THEME, parseTheme } from './pptxTheme'
import { looksLikePersonalData } from './privacy'
import type { Counted, PptxDigest, SlideDigest } from './types'
import { attr, children, dig, parseXml } from './xml'

const SLIDE_WIDTH = 1920
const SLIDE_HEIGHT = 1080
/** 16:9 default used by PowerPoint when `sldSz` is missing. */
const DEFAULT_EMU = { cx: 12_192_000, cy: 6_858_000 }
/** Slides sent onwards are capped; `slideCount` always reports the real number. */
export const MAX_DIGESTED_SLIDES = 60
const TOP_STATS = 12

/** Legacy binary Office files (what a password-protected .pptx is) start with this OLE signature. */
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

const looksEncrypted = (bytes: Uint8Array): boolean =>
  OLE_MAGIC.every((byte, i) => bytes[i] === byte)

async function openZip(bytes: Uint8Array): Promise<JSZip> {
  if (looksEncrypted(bytes)) throw new ImportError('password')
  try {
    return await JSZip.loadAsync(bytes)
  } catch {
    throw new ImportError('corrupt')
  }
}

const readText = (zip: JSZip, path: string): Promise<string | undefined> =>
  zip.file(path)?.async('string') ?? Promise.resolve(undefined)

/** Slide part paths in presentation order (rels + sldIdLst), falling back to numeric file order. */
async function slidePaths(
  zip: JSZip,
  presentation: ReturnType<typeof parseXml>
): Promise<string[]> {
  const byName = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(/\d+/.exec(a.slice(11))?.[0]) - Number(/\d+/.exec(b.slice(11))?.[0]))
  try {
    const relsXml = await readText(zip, 'ppt/_rels/presentation.xml.rels')
    if (!relsXml) return byName
    const targets = new Map(
      children(dig(parseXml(relsXml), 'Relationships'), 'Relationship').map((rel) => [
        attr(rel, 'Id'),
        attr(rel, 'Target')
      ])
    )
    const ordered = children(dig(presentation, 'presentation', 'sldIdLst'), 'sldId')
      .map((id) => targets.get(attr(id, 'id')))
      .filter((target): target is string => Boolean(target))
      .map((target) => `ppt/${target.replace(/^\/?(ppt\/)?/, '')}`)
      .filter((path) => zip.file(path))
    return ordered.length > 0 ? ordered : byName
  } catch {
    return byName
  }
}

function top<T>(counts: Map<T, number>): Array<Counted<T>> {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_STATS)
}

function computeStats(slides: SlideDigest[]): PptxDigest['stats'] {
  const colors = new Map<string, number>()
  const fonts = new Map<string, number>()
  const sizes = new Map<number, number>()
  const add = <K>(map: Map<K, number>, key: K | undefined) => {
    if (key !== undefined) map.set(key, (map.get(key) ?? 0) + 1)
  }
  for (const shape of slides.flatMap((s) => s.shapes)) {
    add(colors, shape.fill)
    add(colors, shape.line)
    for (const run of (shape.paragraphs ?? []).flatMap((p) => p.runs)) {
      add(colors, run.color)
      add(fonts, run.font)
      add(sizes, run.sizePt)
    }
  }
  return { colors: top(colors), fonts: top(fonts), sizesPt: top(sizes) }
}

const slideTexts = (slides: SlideDigest[]): string[] =>
  slides.map((slide) =>
    slide.shapes
      .flatMap((shape) => shape.paragraphs ?? [])
      .map((p) => p.runs.map((r) => r.text).join(''))
      .join('\n')
  )

/** Digests a .pptx held in memory. Throws ImportError('password' | 'corrupt' | 'empty'). */
export async function digestPptx(bytes: Uint8Array): Promise<PptxDigest> {
  const zip = await openZip(bytes)
  const presentationXml = await readText(zip, 'ppt/presentation.xml')
  if (!presentationXml) throw new ImportError('corrupt')
  let presentation
  try {
    presentation = parseXml(presentationXml)
  } catch {
    throw new ImportError('corrupt')
  }

  const warnings: string[] = []
  const themeXml = await readText(zip, 'ppt/theme/theme1.xml')
  const theme = themeXml ? parseTheme(themeXml) : EMPTY_THEME
  if (!themeXml) warnings.push('No theme found')

  const size = dig(presentation, 'presentation', 'sldSz')
  const cx = Number(attr(size, 'cx')) || DEFAULT_EMU.cx
  const cy = Number(attr(size, 'cy')) || DEFAULT_EMU.cy
  const scale: SlideScale = { x: SLIDE_WIDTH / cx, y: SLIDE_HEIGHT / cy }

  const paths = await slidePaths(zip, presentation)
  if (paths.length === 0) throw new ImportError('empty')

  const slides: SlideDigest[] = []
  for (const [i, path] of paths.slice(0, MAX_DIGESTED_SLIDES).entries()) {
    try {
      slides.push(digestSlide((await readText(zip, path)) ?? '', i + 1, theme, scale))
    } catch {
      warnings.push(`Slide ${i + 1} could not be read`)
    }
  }
  return {
    slideCount: paths.length,
    theme,
    slides,
    stats: computeStats(slides),
    mayContainNames: looksLikePersonalData(slideTexts(slides)),
    warnings
  }
}
