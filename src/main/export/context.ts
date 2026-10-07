/** Shared plumbing for the element writers: the export context, colour/position helpers. */
import type PptxGenJS from 'pptxgenjs'
import { resolveColor } from '@shared/deck/tokens'
import type { ColorValue, ElementBase } from '@shared/deck/types'
import type { Asset } from '@shared/assets/types'
import { unitsToInches } from '@shared/deck/layout'
import type { StyleProfile } from '@shared/style/types'
import type { ResolvedFont } from './fonts'
import { isFontInstalled } from './installedFonts'

/** What the exporter needs from the outside world (kept injectable so tests need no disk). */
export interface ExportIo {
  /** Reads an asset from the lesson's assets folder; `undefined` when it does not exist. */
  readAsset(assetId: string): Promise<Uint8Array | undefined>
  /** Rasterises SVG markup to PNG at the given pixel width. Defaults to resvg. */
  rasteriseSvg?(svg: string, widthPx: number): Promise<Uint8Array>
  /**
   * Lower-case names of the fonts installed on this computer (see installedFonts.ts). When given,
   * it decides the 'font not installed' warning; otherwise the profile's `available` flag does.
   */
  installedFonts?: ReadonlySet<string>
  /**
   * Library assets by lesson asset id (only their `credit` is read): the safety net that re-adds a missing
   * "Picture credit:" line to the speaker notes (agents/ASSETS.md §6). Without it the notes are exported as they are.
   */
  assetCredits?: ReadonlyMap<string, Pick<Asset, 'credit'>>
}

/** The io the writers see: the rasteriser is always present. */
export type ResolvedIo = Required<Omit<ExportIo, 'installedFonts' | 'assetCredits'>> &
  Pick<ExportIo, 'installedFonts' | 'assetCredits'>

/** What the writers leave out or could not read, collected for the caller (the editor's export warning). */
export interface ExportReport {
  /** Empty picture spots that were not written (never exported, agents/ASSETS.md §6). */
  skippedSpots: Array<{ slide: number; description: string }>
  /** Labels of pictures whose file could not be read or used (a captioned placeholder was drawn instead). */
  missingAssets: string[]
}

/** Everything an element writer may use. One per slide. */
export interface SlideContext {
  readonly slide: PptxGenJS.Slide
  readonly pptx: PptxGenJS
  readonly style: StyleProfile | null
  readonly io: ResolvedIo
  /** 1-based slide number, used in user-facing warnings. */
  readonly slideNumber: number
  /** Records a user-facing warning (deduplicated by the exporter). */
  warn(message: string): void
  /** Collects skipped spots and missing pictures (one per export). */
  readonly report: ExportReport
}

const HEX6 = /^#?([0-9a-f]{6})$/i
const HEX3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX8 = /^#?([0-9a-f]{6})[0-9a-f]{2}$/i

/** Returns an `RRGGBB` string (what PptxGenJS wants) for a token or hex value; black if invalid. */
export function hexOf(ctx: Pick<SlideContext, 'style' | 'warn'>, value: ColorValue): string {
  const resolved = resolveColor(value, ctx.style)
  const m6 = HEX6.exec(resolved) ?? HEX8.exec(resolved)
  if (m6) return m6[1].toUpperCase()
  const m3 = HEX3.exec(resolved)
  if (m3) return `${m3[1]}${m3[1]}${m3[2]}${m3[2]}${m3[3]}${m3[3]}`.toUpperCase()
  ctx.warn(`The colour “${String(value)}” was not valid, so black was used.`)
  return '000000'
}

/** Position and size in inches, as PptxGenJS expects. */
export interface InchBox {
  x: number
  y: number
  w: number
  h: number
}

/** Converts an element's box from slide units to inches. */
export function inchBox(el: Pick<ElementBase, 'x' | 'y' | 'w' | 'h'>): InchBox {
  return {
    x: unitsToInches(el.x),
    y: unitsToInches(el.y),
    w: unitsToInches(el.w),
    h: unitsToInches(el.h)
  }
}

/** Records a warning about the current slide ("Slide 3: …"). */
export function slideWarn(ctx: SlideContext, message: string): void {
  ctx.warn(`Slide ${ctx.slideNumber}: ${message}`)
}

/** Corner radius in inches for a rounded rectangle, capped at a full pill (half the short side). */
export function radiusInches(radiusUnits: number, box: InchBox): number {
  return Math.min(unitsToInches(Math.max(radiusUnits, 0)), Math.min(box.w, box.h) / 2)
}

/** Records a warning (once per family) when a font is known not to be installed here. */
export function noteFont(ctx: SlideContext, font: ResolvedFont): ResolvedFont {
  const installed = ctx.io.installedFonts
  const missing = installed ? !isFontInstalled(installed, font.family) : !font.available
  if (missing) {
    ctx.warn(
      `The font “${font.family}” may not be installed on this computer, so PowerPoint could substitute another one.`
    )
  }
  return font
}
