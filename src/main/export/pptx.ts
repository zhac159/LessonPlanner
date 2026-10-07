/**
 * Deck to .pptx (design/deck-model.md §5). Pure service: no Electron, no disk. Assets and the SVG
 * rasteriser are injected, so tests and the app use the same code path.
 */
import PptxGenJS from 'pptxgenjs'
import type { Deck, Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { notesWithCredits } from '@shared/assets/credits'
import { hexOf, type ExportIo, type ExportReport, type SlideContext } from './context'
import { writeElements } from './element'
import { cleanInline, cleanText } from './sanitize'
import { normalisePptx } from './normalise'
import { rasteriseSvg } from './rasterise'

export type { ExportIo } from './context'

/** The finished file plus the user-facing warnings for the export toast. */
export interface ExportResult extends ExportReport {
  bytes: Uint8Array
  warnings: string[]
}

async function writeSlide(
  pptx: PptxGenJS,
  deckSlide: Slide,
  slideNumber: number,
  base: Pick<SlideContext, 'style' | 'io' | 'warn' | 'report'>
): Promise<void> {
  const ctx: SlideContext = { ...base, pptx, slide: pptx.addSlide(), slideNumber }
  const background = deckSlide.background ?? { color: 'token:background' as const }
  ctx.slide.background = {
    color: hexOf(ctx, background.color),
    ...(background.opacity !== undefined && background.opacity < 1
      ? { transparency: Math.round((1 - Math.max(background.opacity, 0)) * 100) }
      : {})
  }
  await writeElements(ctx, deckSlide.elements)
  // Her notes, plus a "Picture credit:" line for every picture that needs one and does not have it yet.
  const notes = notesWithCredits(deckSlide, base.io.assetCredits ?? new Map())
  if (notes?.trim()) ctx.slide.addNotes(cleanText(notes))
}

/**
 * Exports a deck as a PowerPoint file (16:9 widescreen, 1 slide unit = 1/144 in). Tokens are
 * resolved to hex, text keeps its per-run colours, diagrams are embedded as 2x PNGs. Problems that
 * do not stop the export (missing picture, font not installed) come back as `warnings`.
 */
export async function exportDeckToPptx(
  deck: Deck,
  style: StyleProfile | null,
  io: ExportIo
): Promise<ExportResult> {
  const warnings: string[] = []
  const warn = (message: string): void => {
    if (!warnings.includes(message)) warnings.push(message)
  }
  const report: ExportReport = { skippedSpots: [], missingAssets: [] }
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = cleanInline(deck.title)
  pptx.subject = cleanInline(deck.meta.subject ?? '')
  pptx.author = 'Slide Planner'
  pptx.company = ''

  const base = {
    style,
    warn,
    report,
    io: {
      readAsset: io.readAsset,
      rasteriseSvg: io.rasteriseSvg ?? rasteriseSvg,
      installedFonts: io.installedFonts,
      assetCredits: io.assetCredits
    }
  }
  if (deck.slides.length === 0)
    warn('This lesson has no slides yet, so the file contains one blank slide.')
  const slides: Slide[] =
    deck.slides.length > 0 ? deck.slides : [{ id: 'blank', kind: 'custom', elements: [] }]
  for (const [index, slide] of slides.entries()) await writeSlide(pptx, slide, index + 1, base)

  const raw = (await pptx.write({ outputType: 'uint8array', compression: true })) as Uint8Array
  return { bytes: await normalisePptx(raw), warnings, ...report }
}
