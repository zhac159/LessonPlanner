/** Test-only: pixel generators for the asset fixtures (photos, logos, card sheets) and tiny image tools. */
import { deflateSync } from 'node:zlib'
import { encodeRaster, pngChunk } from './png'
import type { Raster } from './types'

export type Rgb = [number, number, number]

/** Deterministic pseudo random numbers (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeRaster(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number] | Rgb
): Raster {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = paint(x, y) as [number, number, number, number?]
      const o = (y * width + x) * 4
      data[o] = r
      data[o + 1] = g
      data[o + 2] = b
      data[o + 3] = a
    }
  }
  return { width, height, data }
}

/** A busy, sharp, many-coloured picture: random hard-edged shapes over a gradient plus a little noise. */
export function photoRaster(width: number, height: number, seed: number): Raster {
  const rand = rng(seed)
  const shapes = Array.from({ length: 14 }, () => ({
    cx: rand() * width,
    cy: rand() * height,
    rx: (0.08 + rand() * 0.25) * width,
    ry: (0.08 + rand() * 0.25) * height,
    round: rand() > 0.5,
    color: [rand() * 255, rand() * 255, rand() * 255] as Rgb
  }))
  const tilt = rand() * 80
  return makeRaster(width, height, (x, y) => {
    let color: Rgb = [
      60 + (x / width) * 150 + tilt * 0.3,
      40 + (y / height) * 160,
      200 - (x / width) * 120
    ]
    for (const s of shapes) {
      const dx = (x - s.cx) / s.rx
      const dy = (y - s.cy) / s.ry
      if (s.round ? dx * dx + dy * dy < 1 : Math.abs(dx) < 1 && Math.abs(dy) < 1) color = s.color
    }
    const noise = (rand() - 0.5) * 12
    return [color[0] + noise, color[1] + noise, color[2] + noise]
  })
}

/** Box blur, `passes` times: turns a sharp picture into a blurry one. */
export function blurRaster(raster: Raster, radius: number, passes = 3): Raster {
  let current = raster
  for (let p = 0; p < passes; p++) {
    const { width, height } = current
    const next = new Uint8ClampedArray(current.data.length)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sum = [0, 0, 0, 0]
        let n = 0
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const xx = Math.min(width - 1, Math.max(0, x + dx))
            const yy = Math.min(height - 1, Math.max(0, y + dy))
            const o = (yy * width + xx) * 4
            for (let c = 0; c < 4; c++) sum[c] += current.data[o + c]
            n++
          }
        }
        const o = (y * width + x) * 4
        for (let c = 0; c < 4; c++) next[o + c] = sum[c] / n
      }
    }
    current = { width, height, data: next }
  }
  return current
}

/** A small flat badge on a transparent background (a logo or an icon). */
export function badgeRaster(size: number, color: Rgb = [20, 40, 110], transparent = true): Raster {
  const c = size / 2
  return makeRaster(size, size, (x, y) => {
    const d = Math.hypot(x - c, y - c)
    if (d > c * 0.92) return transparent ? [0, 0, 0, 0] : [255, 255, 255]
    if (d > c * 0.78) return [255, 255, 255]
    return Math.abs(x - c) < size * 0.06 || Math.abs(y - c) < size * 0.06 ? [255, 255, 255] : color
  })
}

export interface CardSheetOptions {
  cols: number
  rows: number
  cardWidth?: number
  cardHeight?: number
  gap?: number
  /** Margin around the sheet; 0 makes the cards touch the picture's edge. */
  margin?: number
  border?: Rgb
  /** Changes the pictures in the cards. */
  seed?: number
  background?: Rgb
}

/** Rounded bordered cards on a plain background, each holding a coloured blob and a dark "word" bar. */
export function cardSheet(options: CardSheetOptions): Raster {
  const { cols, rows, cardWidth = 90, cardHeight = 100, gap = 8, margin = 10 } = options
  const border = options.border ?? [40, 100, 170]
  const background = options.background ?? [255, 255, 255]
  const rand = rng(options.seed ?? 1)
  const colors = Array.from(
    { length: cols * rows },
    () => [rand() * 220, rand() * 220, rand() * 220] as Rgb
  )
  const width = margin * 2 + cols * cardWidth + (cols - 1) * gap
  const height = margin * 2 + rows * cardHeight + (rows - 1) * gap
  const radius = 12
  return makeRaster(width, height, (x, y) => {
    const col = Math.floor((x - margin) / (cardWidth + gap))
    const row = Math.floor((y - margin) / (cardHeight + gap))
    if (col < 0 || row < 0 || col >= cols || row >= rows) return background
    const lx = x - margin - col * (cardWidth + gap)
    const ly = y - margin - row * (cardHeight + gap)
    if (lx >= cardWidth || ly >= cardHeight) return background
    // distance to the rounded rectangle outline (negative inside)
    const qx = Math.abs(lx - cardWidth / 2) - (cardWidth / 2 - radius)
    const qy = Math.abs(ly - cardHeight / 2) - (cardHeight / 2 - radius)
    const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
    if (d > 0) return background
    if (d > -3) return border
    const color = colors[row * cols + col]
    if (Math.hypot(lx - cardWidth / 2, ly - cardHeight * 0.38) < cardWidth * 0.26) return color
    if (
      ly > cardHeight * 0.72 &&
      ly < cardHeight * 0.84 &&
      Math.abs(lx - cardWidth / 2) < cardWidth * 0.3
    )
      return [30, 30, 30]
    return [255, 255, 255]
  })
}

export const pngOf = (raster: Raster): Uint8Array => encodeRaster(raster)

/** An Adam7-interlaced 8-bit RGBA PNG of the raster, to exercise the decoder's interlace path. */
export function interlacedPng(raster: Raster): Uint8Array {
  const { width, height, data } = raster
  const passes = [
    [0, 0, 8, 8],
    [4, 0, 8, 8],
    [0, 4, 4, 8],
    [2, 0, 4, 4],
    [0, 2, 2, 4],
    [1, 0, 2, 2],
    [0, 1, 1, 2]
  ]
  const rows: Buffer[] = []
  for (const [x0, y0, dx, dy] of passes) {
    for (let y = y0; y < height; y += dy) {
      const line = [0]
      for (let x = x0; x < width; x += dx)
        line.push(...data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4))
      if (line.length > 1) rows.push(Buffer.from(line))
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  header[12] = 1
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', header),
      pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
      pngChunk('IEND', Buffer.alloc(0))
    ])
  )
}

export const dataUri = (png: Uint8Array): string =>
  `image/png;base64,${Buffer.from(png).toString('base64')}`
