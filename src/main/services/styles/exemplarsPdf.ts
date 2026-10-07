/** Text blocks of chosen PDF pages (pdfjs text positions on the 1920 x 1080 grid): the PDF half of exemplar digests. */
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@shared/deck/types'

/** One block of text on a slide: its box, its lines, its largest font size (slide points, 13.33 in wide). */
export interface PageBlock {
  x: number
  y: number
  w: number
  h: number
  lines: string[]
  sizePt: number
  bold: boolean
}

interface TextItem {
  str: string
  transform: number[]
  width: number
  height: number
  fontName?: string
}

interface Line {
  left: number
  top: number
  right: number
  bottom: number
  size: number
  text: string
}

/** A 13.33 in slide is 960 pdf points wide: sizes are reported in PowerPoint points. */
const SLIDE_POINTS_WIDE = 960

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
let pdfjs: Promise<PdfJs> | undefined
const loadPdfJs = (): Promise<PdfJs> => (pdfjs ??= import('pdfjs-dist/legacy/build/pdf.mjs'))

function linesOf(items: readonly TextItem[], width: number, height: number): Line[] {
  const sx = SLIDE_WIDTH / width
  const sy = SLIDE_HEIGHT / height
  const placed = items
    .filter((item) => item.str.trim() !== '' || item.str === ' ')
    .map((item) => ({
      str: item.str,
      left: (item.transform[4] ?? 0) * sx,
      top: (height - (item.transform[5] ?? 0) - item.height) * sy,
      width: item.width * sx,
      size: item.height * sy
    }))
    .sort((a, b) => a.top - b.top || a.left - b.left)
  const lines: Array<{ items: typeof placed; top: number }> = []
  for (const item of placed) {
    const line = lines.find((l) => Math.abs(l.top - item.top) < Math.max(6, item.size * 0.5))
    if (line) line.items.push(item)
    else lines.push({ items: [item], top: item.top })
  }
  return lines
    .map((line) => {
      const row = [...line.items].sort((a, b) => a.left - b.left)
      let text = ''
      let end = row[0]?.left ?? 0
      for (const item of row) {
        const gap = item.left - end
        if (text && gap > item.size * 0.25 && !/\s$/.test(text) && !/^\s/.test(item.str))
          text += ' '
        text += item.str
        end = Math.max(end, item.left + item.width)
      }
      const size = Math.max(...row.map((i) => i.size))
      return {
        left: row[0]?.left ?? 0,
        top: line.top,
        right: end,
        bottom: line.top + size,
        size,
        text: text.replace(/\s+/g, ' ').trim()
      }
    })
    .filter((line) => line.text !== '')
    .sort((a, b) => a.top - b.top || a.left - b.left)
}

/** Lines that start under each other with similar size join into one block. */
function blocksOf(lines: readonly Line[]): PageBlock[] {
  const blocks: Array<{ lines: Line[] }> = []
  for (const line of lines) {
    const block = blocks.find((b) => {
      const last = b.lines.at(-1)!
      return (
        Math.abs(last.left - line.left) < 60 &&
        line.top - last.bottom < last.size * 1.2 &&
        line.top >= last.top &&
        Math.abs(last.size - line.size) / last.size < 0.3
      )
    })
    if (block) block.lines.push(line)
    else blocks.push({ lines: [line] })
  }
  const toPt = SLIDE_POINTS_WIDE / SLIDE_WIDTH
  return blocks
    .map(({ lines: l }) => {
      const left = Math.min(...l.map((x) => x.left))
      const top = Math.min(...l.map((x) => x.top))
      return {
        x: Math.round(left),
        y: Math.round(top),
        w: Math.round(Math.max(...l.map((x) => x.right)) - left),
        h: Math.round(Math.max(...l.map((x) => x.bottom)) - top),
        lines: l.map((x) => x.text),
        sizePt: Math.round(Math.max(...l.map((x) => x.size)) * toPt),
        bold: false
      }
    })
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

/** The text blocks of each requested page (1-based); a page that cannot be read is left out. */
export async function readPdfPageText(
  bytes: Uint8Array,
  pages: readonly number[]
): Promise<Map<number, PageBlock[]>> {
  const lib = await loadPdfJs()
  const task = lib.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, verbosity: 0 })
  const out = new Map<number, PageBlock[]>()
  try {
    const doc = await task.promise
    for (const number of new Set(pages)) {
      if (number < 1 || number > doc.numPages) continue
      const page = await doc.getPage(number)
      const view = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      const items = (content.items as TextItem[]).filter((i) => typeof i.str === 'string')
      out.set(number, blocksOf(linesOf(items, view.width, view.height)))
      page.cleanup()
    }
  } finally {
    await task.destroy().catch(() => undefined)
  }
  return out
}
