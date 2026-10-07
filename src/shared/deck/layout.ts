/**
 * Pure layout maths shared by the on-screen renderer and the .pptx exporter so previews and exports
 * cannot drift (design/deck-model.md §4 and §5). No DOM, no Node: everything is deterministic.
 *
 * Units: slide coordinates are 1920 × 1080 "units"; `1 pt = 2 units`; `1 in = 144 units`.
 */
import type { StyleProfile } from '../style/types'

/** Units per inch (a 1920-unit slide is 13.333 in wide). */
export const UNITS_PER_INCH = 144
/** Units per typographic point. */
export const UNITS_PER_PT = 2

/** Converts slide units to inches (PptxGenJS positions). */
export function unitsToInches(units: number): number {
  return units / UNITS_PER_INCH
}

/** Converts a font size in points to slide units. */
export function ptToUnits(pt: number): number {
  return pt * UNITS_PER_PT
}

/** Converts slide units to points. */
export function unitsToPt(units: number): number {
  return units / UNITS_PER_PT
}

/** Widths in em for a few character classes: good enough to wrap pills identically everywhere. */
const SPACE_EM = 0.28
const NARROW_EM = 0.3
const WIDE_EM = 0.86
const UPPER_EM = 0.68
const DIGIT_EM = 0.58
const DEFAULT_EM = 0.55
const CJK_EM = 1
const BOLD_FACTOR = 1.07
const NARROW = new Set("iljtfI.,:;'’|!()[]- ")
const WIDE = new Set('mwMW@%')

function charWidthEm(ch: string): number {
  if (ch === ' ') return SPACE_EM
  if (NARROW.has(ch)) return NARROW_EM
  if (WIDE.has(ch)) return WIDE_EM
  if (ch >= '0' && ch <= '9') return DIGIT_EM
  if (ch !== ch.toLowerCase() && ch === ch.toUpperCase()) return UPPER_EM
  const code = ch.codePointAt(0) ?? 0
  return code >= 0x2e80 ? CJK_EM : DEFAULT_EM
}

/**
 * Estimates the rendered width of one line of text, in slide units. Deterministic (no font
 * metrics), so the renderer and the exporter agree on where chips wrap.
 */
export function estimateTextWidth(text: string, fontSizePt: number, bold = false): number {
  let em = 0
  for (const ch of text) em += charWidthEm(ch)
  return em * ptToUnits(fontSizePt) * (bold ? BOLD_FACTOR : 1)
}

/** A rectangle in slide units. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** How chips look, resolved from the profile's `chip` component. */
export interface ChipLayoutStyle {
  fontSizePt: number
  bold: boolean
  /** Vertical padding in units. */
  padY: number
  /** Horizontal padding in units. */
  padX: number
  /** Gap between chips and between rows, in units. */
  gap: number
}

const DEFAULT_CHIP: ChipLayoutStyle = { fontSizePt: 15, bold: true, padY: 12, padX: 27, gap: 18 }

/** Reads the chip look from `style.components[styleRef]`, falling back to sensible defaults. */
export function chipLayoutStyle(style: StyleProfile | null, styleRef = 'chip'): ChipLayoutStyle {
  const c = style?.components[styleRef]
  return {
    fontSizePt: c?.sizePt ?? DEFAULT_CHIP.fontSizePt,
    bold: c?.bold ?? DEFAULT_CHIP.bold,
    padY: c?.padding?.[0] ?? DEFAULT_CHIP.padY,
    padX: c?.padding?.[1] ?? DEFAULT_CHIP.padX,
    gap: DEFAULT_CHIP.gap
  }
}

/** One positioned pill. */
export interface ChipRect extends Box {
  text: string
}

/**
 * Lays chips out as a wrapping row of pills inside `box`: left to right, a new row when the next
 * pill would cross the right edge. A pill wider than the box is clamped to the box width. Rows
 * may run past `box.h`; callers decide whether to warn.
 */
export function layoutChips(
  items: readonly string[],
  box: Box,
  style: StyleProfile | null,
  styleRef = 'chip'
): ChipRect[] {
  const s = chipLayoutStyle(style, styleRef)
  const h = Math.round(ptToUnits(s.fontSizePt) * 1.2 + 2 * s.padY)
  const right = box.x + box.w
  const rects: ChipRect[] = []
  let x = box.x
  let y = box.y
  for (const text of items) {
    const w = Math.min(
      box.w,
      Math.round(estimateTextWidth(text, s.fontSizePt, s.bold) + 2 * s.padX)
    )
    if (x > box.x && x + w > right) {
      x = box.x
      y += h + s.gap
    }
    rects.push({ text, x, y, w, h })
    x += w + s.gap
  }
  return rects
}
