/**
 * Exemplars (agents/ASSETS.md §5.7, defect 7): the pages the analysis named in `exemplarCandidates` become deck-model
 * `Slide` digests of her REAL slides (text with its box, her pictures by name), so generation can show two of them.
 * Built locally from the stored file (pptx digest, or the PDF page's text and the extracted picture boxes): no Claude call.
 * Literal dates never survive into a digest (dates.ts).
 */
import type { FileAnalysis } from '@shared/ai/types'
import type { Element, Slide, SlideKind } from '@shared/deck/types'
import type { Exemplar } from '@shared/style/types'
import type { SlideDigest } from '../../import/types'
import { stripDates } from './dates'
import { readPdfPageText, type PageBlock } from './exemplarsPdf'

/** Exemplars kept per file, and for the whole style. Generation shows two. */
export const EXEMPLARS_PER_FILE = 3
export const EXEMPLARS_PER_STYLE = 2

/** A picture on a page (from the extraction service). */
export interface PagePicture {
  page: number
  box: { x: number; y: number; w: number; h: number }
  name: string
  alt: string
}

const kindOf = (analysis: FileAnalysis, page: number): SlideKind =>
  analysis.slideKinds.find((entry) => entry.page === page)?.kind ?? 'custom'

const textElement = (
  id: string,
  block: PageBlock,
  role: 'heading' | 'kicker' | 'body'
): Element => ({
  id,
  type: 'text',
  role,
  x: block.x,
  y: block.y,
  w: block.w,
  h: block.h,
  fontSizePt: block.sizePt,
  paragraphs: block.lines.map((line) => ({
    runs: [{ text: line, ...(block.bold ? { bold: true } : {}) }]
  }))
})

function roleOf(block: PageBlock, index: number, biggest: number): 'heading' | 'kicker' | 'body' {
  const short = block.lines.length === 1 && block.lines[0]!.length <= 24
  if (short && /:$/.test(block.lines[0]!) && block.y < 240) return 'kicker'
  return index === 0 || block.sizePt >= biggest ? 'heading' : 'body'
}

/** Blocks (already in reading order) + pictures -> a Slide. Dates are removed; blocks that were only a date are dropped. */
export function slideFromBlocks(
  id: string,
  kind: SlideKind,
  blocks: readonly PageBlock[],
  pictures: readonly PagePicture[]
): Slide {
  const clean = blocks
    .map((block) => ({ ...block, lines: block.lines.map(stripDates).filter((l) => l !== '') }))
    .filter((block) => block.lines.length > 0)
  const biggest = Math.max(0, ...clean.map((b) => b.sizePt))
  const elements: Element[] = clean.map((block, i) =>
    textElement(`${id}-e${i + 1}`, block, roleOf(block, i, biggest))
  )
  pictures.forEach((picture, i) =>
    elements.push({
      id: `${id}-p${i + 1}`,
      type: 'image',
      name: picture.name,
      x: picture.box.x,
      y: picture.box.y,
      w: picture.box.w,
      h: picture.box.h,
      fit: 'contain',
      alt: picture.alt
    })
  )
  return { id, kind, elements }
}

/** One pptx slide digest -> blocks (its text shapes with a box, top to bottom). */
export function blocksFromDigest(slide: SlideDigest): PageBlock[] {
  return slide.shapes
    .filter((shape) => shape.kind === 'text' && shape.box && shape.paragraphs?.length)
    .map((shape) => {
      const paragraphs = shape.paragraphs ?? []
      const runs = paragraphs.flatMap((p) => p.runs)
      return {
        ...shape.box!,
        lines: paragraphs
          .map((p) =>
            p.runs
              .map((r) => r.text)
              .join('')
              .trim()
          )
          .filter(Boolean),
        sizePt: Math.max(0, ...runs.map((r) => r.sizePt ?? 0)) || 18,
        bold: runs.some((r) => r.bold)
      }
    })
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

export interface ExemplarSource {
  sourceId: string
  kind: 'pdf' | 'pptx'
  bytes: Uint8Array
  analysis: FileAnalysis
  pictures: readonly PagePicture[]
}

/** The exemplars of one file (at most EXEMPLARS_PER_FILE), in the analysis's own order of preference. */
export async function buildFileExemplars(source: ExemplarSource): Promise<Exemplar[]> {
  const wanted = source.analysis.exemplarCandidates.slice(0, EXEMPLARS_PER_FILE)
  if (wanted.length === 0) return []
  const pages = wanted.map((w) => w.page)
  let blocksByPage: Map<number, PageBlock[]>
  if (source.kind === 'pdf') {
    blocksByPage = await readPdfPageText(source.bytes, pages)
  } else {
    const { digestPptx } = await import('../../import/pptxDigest')
    const digest = await digestPptx(source.bytes)
    blocksByPage = new Map(digest.slides.map((s) => [s.index, blocksFromDigest(s)]))
  }
  return wanted.flatMap(({ page, why }) => {
    const blocks = blocksByPage.get(page)
    if (!blocks) return []
    const id = `${source.sourceId}-p${page}`
    const digest = slideFromBlocks(
      id,
      kindOf(source.analysis, page),
      blocks,
      source.pictures.filter((p) => p.page === page)
    )
    return digest.elements.length
      ? [{ sourceId: source.sourceId, page, kind: digest.kind, digest, why: stripDates(why) }]
      : []
  })
}

/**
 * The style's exemplars from every file's, in queue order: one per file per round, a new slide kind before a repeat,
 * at most EXEMPLARS_PER_STYLE.
 */
export function chooseExemplars(perFile: readonly (readonly Exemplar[])[]): Exemplar[] {
  const chosen: Exemplar[] = []
  const kinds = new Set<SlideKind>()
  for (const pass of ['new-kind', 'any'] as const) {
    for (let round = 0; round < EXEMPLARS_PER_FILE; round++) {
      for (const list of perFile) {
        const next = list[round]
        if (!next || chosen.includes(next) || chosen.length >= EXEMPLARS_PER_STYLE) continue
        if (pass === 'new-kind' && kinds.has(next.kind)) continue
        chosen.push(next)
        kinds.add(next.kind)
      }
    }
  }
  return chosen
}
