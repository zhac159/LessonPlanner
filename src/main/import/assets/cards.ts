/**
 * EXPERIMENTAL: splits one bitmap that holds several cards (a strip of symbol cards, a grid of word cards)
 * into one picture per card. Works on rounded rectangles on a plain background by finding connected regions
 * of "not background" pixels; every card has to be closed by its border. It is a guess: callers must show the
 * result for review and keep the original bitmap as the fallback.
 */
import { resizeOverWhite } from './analysis'
import { decodeImage } from './decode'
import { encodeRaster } from './png'
import type { CardRegion, CardSplit, ImageDecoder, ImageMime, Raster } from './types'

const WORK = 400
/** A card must cover at least this share of the picture and be at least this many working pixels wide and high. */
const MIN_AREA_SHARE = 0.012
const MIN_SIDE = 10
/** Margin of background colour added around the picture before looking for regions. */
const PAD = 6

interface Region {
  x0: number
  y0: number
  x1: number
  y1: number
  area: number
}

const bboxArea = (r: Region): number => (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** The background colour (4-bit quantised from the border ring) and the share of the ring that has it. */
function plainBackground(rgb: Float32Array, w: number, h: number) {
  const counts = new Map<number, number>()
  let total = 0
  const probe = (x: number, y: number) => {
    const i = (y * w + x) * 3
    const key = ((rgb[i] >> 4) << 8) | ((rgb[i + 1] >> 4) << 4) | (rgb[i + 2] >> 4)
    counts.set(key, (counts.get(key) ?? 0) + 1)
    total++
  }
  for (let x = 0; x < w; x++) {
    probe(x, 0)
    probe(x, h - 1)
  }
  for (let y = 1; y < h - 1; y++) {
    probe(0, y)
    probe(w - 1, y)
  }
  let best = 0
  let bestKey = 0
  for (const [key, count] of counts) {
    if (count > best) {
      best = count
      bestKey = key
    }
  }
  return {
    color: [((bestKey >> 8) << 4) + 8, (((bestKey >> 4) & 15) << 4) + 8, ((bestKey & 15) << 4) + 8],
    share: total ? best / total : 0
  }
}

/** Connected regions (8-neighbourhood) of a mask, as bounding boxes with pixel counts. */
function regionsOf(mask: Uint8Array, w: number, h: number): Region[] {
  const seen = new Uint8Array(w * h)
  const out: Region[] = []
  const stack: number[] = []
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue
    const region: Region = { x0: w, y0: h, x1: 0, y1: 0, area: 0 }
    stack.push(start)
    seen[start] = 1
    while (stack.length) {
      const p = stack.pop() as number
      const x = p % w
      const y = (p - x) / w
      region.area++
      if (x < region.x0) region.x0 = x
      if (x > region.x1) region.x1 = x
      if (y < region.y0) region.y0 = y
      if (y > region.y1) region.y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const q = ny * w + nx
          if (mask[q] && !seen[q]) {
            seen[q] = 1
            stack.push(q)
          }
        }
      }
    }
    out.push(region)
  }
  return out
}

interface Detected {
  /** In working-thumbnail coordinates, reading order (rows top to bottom, left to right). */
  regions: Array<Region & { row: number; col: number }>
  scale: number
  /** Working thumbnail size the regions are measured in. */
  work: { w: number; h: number }
  confidence: number
}

/** The colour shared by the four corners of the picture, or null when they differ. */
function cornerColor(rgb: Float32Array, w: number, h: number): number[] | null {
  const at = (x: number, y: number) => [0, 1, 2].map((c) => rgb[(y * w + x) * 3 + c])
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)]
  const first = corners[0]
  const same = corners.every((c) => c.reduce((sum, v, i) => sum + Math.abs(v - first[i]), 0) < 30)
  return same ? first : null
}

/** True when at least three sides of the region are mostly straight edges (a card, not an ellipse or a blob). */
function looksRectangular(mask: Uint8Array, w: number, r: Region): boolean {
  const rw = r.x1 - r.x0 + 1
  const rh = r.y1 - r.y0 + 1
  const run = (horizontal: boolean, fixed: number[]): boolean => {
    const length = horizontal ? rw : rh
    let hits = 0
    let total = 0
    for (let k = Math.floor(length * 0.15); k < Math.ceil(length * 0.85); k++) {
      total++
      for (const f of fixed) {
        const x = horizontal ? r.x0 + k : f
        const y = horizontal ? f : r.y0 + k
        if (mask[y * w + x]) {
          hits++
          break
        }
      }
    }
    return total > 0 && hits / total >= 0.85
  }
  const band = (from: number, step: number) => [0, 1, 2].map((i) => from + step * i)
  const sides = [
    run(true, band(r.y0, 1)),
    run(true, band(r.y1, -1)),
    run(false, band(r.x0, 1)),
    run(false, band(r.x1, -1))
  ]
  return sides.filter(Boolean).length >= 3
}

/** Finds the card regions of a raster; empty when it does not look like cards on a plain background. */
export function detectCards(raster: Raster): Detected {
  const empty: Detected = { regions: [], scale: 1, work: { w: 1, h: 1 }, confidence: 0 }
  if (raster.width < 40 || raster.height < 24) return empty
  const scale = Math.max(1, Math.max(raster.width, raster.height) / WORK)
  const iw = Math.max(1, Math.round(raster.width / scale))
  const ih = Math.max(1, Math.round(raster.height / scale))
  const inner = resizeOverWhite(raster, iw, ih)
  // Cards that touch the picture's edge have no background ring: add a margin of the border colour (or white).
  const ring = plainBackground(inner.rgb, iw, ih)
  // Rounded cards leave the picture's four corners as background even when their borders touch its edges.
  const corners = cornerColor(inner.rgb, iw, ih)
  const bg = corners ?? (ring.share >= 0.6 ? ring.color : [255, 255, 255])
  const w = iw + PAD * 2
  const h = ih + PAD * 2
  const rgb = new Float32Array(w * h * 3)
  for (let i = 0; i < w * h; i++) {
    rgb[i * 3] = bg[0]
    rgb[i * 3 + 1] = bg[1]
    rgb[i * 3 + 2] = bg[2]
  }
  for (let y = 0; y < ih; y++)
    rgb.set(inner.rgb.subarray(y * iw * 3, (y + 1) * iw * 3), ((y + PAD) * w + PAD) * 3)

  // Foreground = clearly not the background colour; one dilation closes hairline gaps in anti-aliased borders.
  const fg = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const d =
      Math.abs(rgb[i * 3] - bg[0]) +
      Math.abs(rgb[i * 3 + 1] - bg[1]) +
      Math.abs(rgb[i * 3 + 2] - bg[2])
    fg[i] = d > 60 ? 1 : 0
  }
  const grown = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!fg[y * w + x]) continue
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) grown[ny * w + nx] = 1
        }
      }
    }
  }

  let regions = regionsOf(grown, w, h).filter((r) => {
    const rw = r.x1 - r.x0 + 1
    const rh = r.y1 - r.y0 + 1
    const aspect = rw / rh
    return (
      rw >= MIN_SIDE &&
      rh >= MIN_SIDE &&
      rw * rh >= iw * ih * MIN_AREA_SHARE &&
      aspect >= 0.4 &&
      aspect <= 3.5 &&
      looksRectangular(grown, w, r)
    )
  })
  // Drop regions that sit inside a bigger one (the picture inside a card whose border did not close).
  regions = regions.filter(
    (r) =>
      !regions.some(
        (o) =>
          o !== r &&
          o.x0 <= r.x0 &&
          o.y0 <= r.y0 &&
          o.x1 >= r.x1 &&
          o.y1 >= r.y1 &&
          bboxArea(o) > bboxArea(r)
      )
  )
  if (regions.length === 0) return empty

  const medianArea = median(regions.map(bboxArea))
  const consistent = regions.filter(
    (r) => bboxArea(r) >= medianArea * 0.5 && bboxArea(r) <= medianArea * 1.6
  )
  if (consistent.length === 0) return empty

  // Reading order: rows by vertical centre, then left to right.
  const medianH = median(consistent.map((r) => r.y1 - r.y0 + 1))
  const byY = [...consistent].sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1))
  const rows: Region[][] = []
  for (const region of byY) {
    const row = rows.find(
      (r) => Math.abs((r[0].y0 + r[0].y1) / 2 - (region.y0 + region.y1) / 2) < medianH * 0.5
    )
    if (row) row.push(region)
    else rows.push([region])
  }
  const shift = (r: Region): Region => ({
    ...r,
    x0: Math.max(0, r.x0 - PAD),
    y0: Math.max(0, r.y0 - PAD),
    x1: Math.min(iw - 1, r.x1 - PAD),
    y1: Math.min(ih - 1, r.y1 - PAD)
  })
  const ordered = rows.flatMap((row, rowIndex) =>
    row.sort((a, b) => a.x0 - b.x0).map((region, col) => ({ ...shift(region), row: rowIndex, col }))
  )

  // Confidence: most regions are the same size and rows line up in columns.
  const sameSize = consistent.length / regions.length
  const colsPerRow = rows.map((r) => r.length)
  const regular = colsPerRow.every((n) => n === colsPerRow[0]) ? 1 : 0.6
  const plain = corners || ring.share >= 0.6 ? 1 : 0.8
  const confidence = Math.round(Math.min(1, sameSize * plain * regular) * 100) / 100
  return { regions: ordered, scale, work: { w: iw, h: ih }, confidence }
}

/** Labels for `count` cards from a text block with one label per line, in reading order. */
export function labelsFromText(text: string, count: number): string[] | undefined {
  const lines = text
    .split(/\n|\|/)
    .map((l) => l.trim())
    .filter(Boolean)
  return lines.length === count ? lines : undefined
}

function cropRaster(raster: Raster, x0: number, y0: number, x1: number, y1: number): Raster {
  const w = x1 - x0
  const h = y1 - y0
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const from = ((y0 + y) * raster.width + x0) * 4
    data.set(raster.data.subarray(from, from + w * 4), y * w * 4)
  }
  return { width: w, height: h, data }
}

/** Splits an already decoded bitmap into cards. At least two cards are needed, otherwise `cards` is empty. */
export function splitCardsFromRaster(raster: Raster, labels?: string[]): CardSplit {
  const found = detectCards(raster)
  if (found.regions.length < 2) return { cards: [], experimental: true, confidence: 0 }
  const pad = Math.ceil(found.scale * 1.5)
  const cards: CardRegion[] = found.regions.map((region, i) => {
    const x0 = Math.max(0, Math.floor(region.x0 * found.scale) - pad)
    const y0 = Math.max(0, Math.floor(region.y0 * found.scale) - pad)
    const x1 = Math.min(raster.width, Math.ceil((region.x1 + 1) * found.scale) + pad)
    const y1 = Math.min(raster.height, Math.ceil((region.y1 + 1) * found.scale) + pad)
    const piece = cropRaster(raster, x0, y0, x1, y1)
    return {
      box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
      row: region.row,
      col: region.col,
      bytes: encodeRaster(piece),
      mime: 'image/png',
      width: piece.width,
      height: piece.height,
      label: labels && labels.length === found.regions.length ? labels[i] : undefined
    }
  })
  return { cards, experimental: true, confidence: found.confidence }
}

/**
 * Splits a picture (encoded bytes) into its cards. `labels` are the words of the cards in reading order, usually
 * from the text near the picture (`labelsFromText`); without them the cards are unlabelled.
 */
export async function cropSymbolCards(
  image: { bytes: Uint8Array; mime: ImageMime; nearbyText?: string },
  options: { decode?: ImageDecoder; labels?: string[] } = {}
): Promise<CardSplit> {
  const raster = await (options.decode ?? decodeImage)(image.bytes, image.mime)
  if (!raster) return { cards: [], experimental: true, confidence: 0 }
  const first = splitCardsFromRaster(raster)
  if (first.cards.length < 2) return first
  const labels =
    options.labels ??
    (image.nearbyText ? labelsFromText(image.nearbyText, first.cards.length) : undefined)
  return labels ? splitCardsFromRaster(raster, labels) : first
}
