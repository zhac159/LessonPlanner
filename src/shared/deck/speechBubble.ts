/**
 * Geometry of the wedge speech bubble (`callout` variant `speech-bubble`, agents/ASSETS.md §5.7): a rounded box
 * with a pointed tail that sticks out of one edge. The element's box is the BODY; the tail protrudes outside it.
 * One path shared by the on-screen renderer (SVG) and the .pptx exporter (custom geometry). Pure.
 */
import type { CalloutTail } from './types'

export type PathSegment =
  | { op: 'M'; x: number; y: number }
  | { op: 'L'; x: number; y: number }
  | { op: 'Q'; cx: number; cy: number; x: number; y: number }
  | { op: 'Z' }

export interface BubbleShape {
  /** Segments in body coordinates (0,0 = top-left of the element box). */
  path: PathSegment[]
  /** Extent of everything drawn, tail included (can be negative or beyond w/h). */
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

export const DEFAULT_TAIL: CalloutTail = 'bottom-left'
export const BUBBLE_RADIUS = 28
export const BUBBLE_STROKE = 4
const SLIDE_H = 1080
/** Longest tail the shape draws (see `speechBubbleShape`). */
const MAX_TAIL = 110

/**
 * The tail to draw: the element's own hint, else bottom-left, else (when a bottom tail would run off the
 * slide, as on her bubble at the bottom right) pointing left.
 */
export function resolveTail(el: { y: number; h: number; tail?: CalloutTail }): CalloutTail {
  if (el.tail) return el.tail
  return el.y + el.h + MAX_TAIL > SLIDE_H ? 'left' : DEFAULT_TAIL
}

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value))

/** The rounded box with the tail inserted on the edge the hint names. `radius` is capped at half the short side. */
export function speechBubbleShape(
  w: number,
  h: number,
  radius: number = BUBBLE_RADIUS,
  tail: CalloutTail = DEFAULT_TAIL
): BubbleShape {
  const r = clamp(radius, 0, Math.min(w, h) / 2)
  const base = clamp(0.12 * Math.min(w, h * 2.2), 36, 120)
  const len = clamp(0.3 * h, 36, 110)
  const lean = base * 0.45
  const side = tail === 'none' ? null : tail
  const inset = (edge: number): number => Math.max(r + 8, 0.08 * edge)
  const bw = Math.min(base, Math.max(w - 2 * r - 16, 8))
  const bh = Math.min(base, Math.max(h - 2 * r - 16, 8))

  const path: PathSegment[] = [{ op: 'M', x: r, y: 0 }]
  const line = (x: number, y: number): void => void path.push({ op: 'L', x, y })
  const corner = (cx: number, cy: number, x: number, y: number): void =>
    void path.push({ op: 'Q', cx, cy, x, y })

  // top edge, left to right
  if (side === 'top-left' || side === 'top-right') {
    const x0 = side === 'top-left' ? inset(w) : w - inset(w) - bw
    const tipX = side === 'top-left' ? x0 - lean : x0 + bw + lean
    line(x0, 0)
    line(tipX, -len)
    line(x0 + bw, 0)
  }
  line(w - r, 0)
  corner(w, 0, w, r)
  // right edge, top to bottom
  if (side === 'right') {
    const y0 = h * 0.55
    line(w, y0)
    line(w + len, y0 + bh + lean)
    line(w, y0 + bh)
  }
  line(w, h - r)
  corner(w, h, w - r, h)
  // bottom edge, right to left
  if (side === 'bottom-left' || side === 'bottom-right') {
    const x0 = side === 'bottom-left' ? inset(w) : w - inset(w) - bw
    const tipX = side === 'bottom-left' ? x0 - lean : x0 + bw + lean
    line(x0 + bw, h)
    line(tipX, h + len)
    line(x0, h)
  }
  line(r, h)
  corner(0, h, 0, h - r)
  // left edge, bottom to top
  if (side === 'left') {
    const y0 = h * 0.55
    line(0, y0 + bh)
    line(-len, y0 + bh + lean)
    line(0, y0)
  }
  line(0, r)
  corner(0, 0, r, 0)
  path.push({ op: 'Z' })

  const bounds = { minX: 0, minY: 0, maxX: w, maxY: h }
  for (const seg of path) {
    if (seg.op === 'Z') continue
    bounds.minX = Math.min(bounds.minX, seg.x)
    bounds.maxX = Math.max(bounds.maxX, seg.x)
    bounds.minY = Math.min(bounds.minY, seg.y)
    bounds.maxY = Math.max(bounds.maxY, seg.y)
  }
  return { path, bounds }
}

const round = (n: number): number => Math.round(n * 100) / 100

/** SVG path data for the segments (`offsetX/Y` shifts the origin, 0 for body coordinates). */
export function bubblePathData(path: readonly PathSegment[], offsetX = 0, offsetY = 0): string {
  return path
    .map((seg) => {
      if (seg.op === 'Z') return 'Z'
      if (seg.op === 'Q') {
        return `Q${round(seg.cx + offsetX)} ${round(seg.cy + offsetY)} ${round(seg.x + offsetX)} ${round(seg.y + offsetY)}`
      }
      return `${seg.op}${round(seg.x + offsetX)} ${round(seg.y + offsetY)}`
    })
    .join(' ')
}
