/**
 * Pixel analysis of one picture: perceptual hashes (dHash), a sharpness estimate and a few colour
 * statistics that feed the kind hint and the quality flags. Pure functions over RGBA rasters.
 */
import { createHash } from 'node:crypto'
import type { Raster } from './types'

export const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex')

/** Longest side of the working thumbnail (hashes, blur and colours are measured on it). */
const THUMB = 512

export interface Thumb {
  width: number
  height: number
  /** RGB over white, 3 floats per pixel, 0..255. */
  rgb: Float32Array
}

/** Area-average resize of RGBA onto `tw x th`, compositing transparency over white. */
export function resizeOverWhite(raster: Raster, tw: number, th: number): Thumb {
  const { width: w, height: h, data } = raster
  const rgb = new Float32Array(tw * th * 3)
  for (let y = 0; y < th; y++) {
    const y0 = Math.floor((y * h) / th)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / th))
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor((x * w) / tw)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / tw))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let yy = y0; yy < y1 && yy < h; yy++) {
        let p = (yy * w + x0) * 4
        for (let xx = x0; xx < x1 && xx < w; xx++, p += 4) {
          const a = data[p + 3] / 255
          const inv = 255 * (1 - a)
          r += data[p] * a + inv
          g += data[p + 1] * a + inv
          b += data[p + 2] * a + inv
          n++
        }
      }
      const o = (y * tw + x) * 3
      if (n > 0) {
        rgb[o] = r / n
        rgb[o + 1] = g / n
        rgb[o + 2] = b / n
      } else {
        rgb[o] = rgb[o + 1] = rgb[o + 2] = 255
      }
    }
  }
  return { width: tw, height: th, rgb }
}

/** The working thumbnail: never upscaled, longest side at most 512. */
export function makeThumb(raster: Raster): Thumb {
  const scale = Math.min(1, THUMB / Math.max(raster.width, raster.height))
  return resizeOverWhite(
    raster,
    Math.max(1, Math.round(raster.width * scale)),
    Math.max(1, Math.round(raster.height * scale))
  )
}

const lumaOf = (rgb: Float32Array, i: number): number =>
  0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2]

function resizeLuma(thumb: Thumb, tw: number, th: number): Float32Array {
  const out = new Float32Array(tw * th)
  for (let y = 0; y < th; y++) {
    const y0 = Math.floor((y * thumb.height) / th)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * thumb.height) / th))
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor((x * thumb.width) / tw)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * thumb.width) / tw))
      let sum = 0
      let n = 0
      for (let yy = y0; yy < y1 && yy < thumb.height; yy++) {
        for (let xx = x0; xx < x1 && xx < thumb.width; xx++) {
          sum += lumaOf(thumb.rgb, yy * thumb.width + xx)
          n++
        }
      }
      out[y * tw + x] = n ? sum / n : 255
    }
  }
  return out
}

/** dHash: `rows` rows of `cols` horizontal "is it getting darker" bits, as hex. */
function dHash(thumb: Thumb, cols: number, rows: number): string {
  const grid = resizeLuma(thumb, cols + 1, rows)
  let bits = ''
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++)
      bits += grid[y * (cols + 1) + x] > grid[y * (cols + 1) + x + 1] ? '1' : '0'
  }
  let hex = ''
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

function colorSignature(thumb: Thumb): string {
  const cells = new Float64Array(27)
  const counts = new Float64Array(9)
  for (let y = 0; y < thumb.height; y++) {
    const cy = Math.min(2, Math.floor((y * 3) / thumb.height))
    for (let x = 0; x < thumb.width; x++) {
      const cell = cy * 3 + Math.min(2, Math.floor((x * 3) / thumb.width))
      const i = (y * thumb.width + x) * 3
      cells[cell * 3] += thumb.rgb[i]
      cells[cell * 3 + 1] += thumb.rgb[i + 1]
      cells[cell * 3 + 2] += thumb.rgb[i + 2]
      counts[cell]++
    }
  }
  let hex = ''
  for (let i = 0; i < 27; i++) {
    const v = counts[Math.floor(i / 3)] ? Math.round(cells[i] / counts[Math.floor(i / 3)]) : 255
    hex += v.toString(16).padStart(2, '0')
  }
  return hex
}

/** Mean absolute difference per channel (0..255) between two colour signatures; Infinity when one is missing. */
export function colorDistance(a: string, b: string): number {
  if (a.length !== 54 || b.length !== 54) return Infinity
  let sum = 0
  for (let i = 0; i < 54; i += 2)
    sum += Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16))
  return sum / 27
}

/** Number of differing bits between two equally long hex strings (Infinity when lengths differ). */
export function hammingHex(a: string, b: string): number {
  if (a.length !== b.length || a.length === 0) return Infinity
  let bits = 0
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) {
      bits += x & 1
      x >>= 1
    }
  }
  return bits
}

/** 98th percentile of the Sobel gradient magnitude of the luma (0..~1000); null when the image has no edges. */
function sharpness(thumb: Thumb): number | null {
  const { width: w, height: h } = thumb
  if (w < 8 || h < 8) return null
  const luma = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) luma[i] = lumaOf(thumb.rgb, i)
  const mags: number[] = []
  let edgy = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx =
        luma[i - w + 1] +
        2 * luma[i + 1] +
        luma[i + w + 1] -
        luma[i - w - 1] -
        2 * luma[i - 1] -
        luma[i + w - 1]
      const gy =
        luma[i + w - 1] +
        2 * luma[i + w] +
        luma[i + w + 1] -
        luma[i - w - 1] -
        2 * luma[i - w] -
        luma[i - w + 1]
      const m = Math.hypot(gx, gy) / 4
      if (m > 3) {
        edgy++
        mags.push(m)
      }
    }
  }
  // Fewer than 0.5 % of the pixels sit on an edge: a flat picture, sharpness is not meaningful.
  if (edgy < (w - 2) * (h - 2) * 0.005) return null
  mags.sort((a, b) => a - b)
  return mags[Math.min(mags.length - 1, Math.floor(mags.length * 0.98))]
}

export interface Analysis {
  perceptualHash: string
  detailHash: string
  /** Mean colour of a 3x3 grid (27 bytes as hex): tells a recoloured or different picture from a re-saved copy. */
  colorSignature: string
  blurScore: number | null
  /** Distinct 4-bit-per-channel colours that hold at least 0.3 % of the pixels. */
  colorBins: number
  /** Share of near-white pixels (after compositing over white). */
  whiteFraction: number
  /** Share of (nearly) transparent pixels in the source. */
  transparentFraction: number
  /** Share of skin-tone pixels (rough RGB rule), 0..1. */
  skinFraction: number
  /** Share of the border ring that is near-white. */
  edgeWhiteFraction: number
  /** Share of the border ring held by its single most common colour (1 = a plain background of any colour). */
  edgePlainShare: number
}

export function analyse(raster: Raster): Analysis {
  const thumb = makeThumb(raster)
  const n = thumb.width * thumb.height
  const step = Math.max(1, Math.floor(n / 20000))
  const bins = new Map<number, number>()
  let white = 0
  let skin = 0
  let samples = 0
  for (let i = 0; i < n; i += step) {
    const r = thumb.rgb[i * 3]
    const g = thumb.rgb[i * 3 + 1]
    const b = thumb.rgb[i * 3 + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    bins.set(key, (bins.get(key) ?? 0) + 1)
    if (r > 240 && g > 240 && b > 240) white++
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    if (r > 95 && g > 40 && b > 20 && mx - mn > 15 && Math.abs(r - g) > 15 && r > g && r > b) skin++
    samples++
  }
  let colorBins = 0
  for (const count of bins.values()) if (count >= samples * 0.003) colorBins++

  let transparent = 0
  let alphaSamples = 0
  const total = raster.width * raster.height
  const alphaStep = Math.max(1, Math.floor(total / 20000))
  for (let i = 0; i < total; i += alphaStep) {
    if (raster.data[i * 4 + 3] < 32) transparent++
    alphaSamples++
  }

  let edgeWhite = 0
  let edgeSamples = 0
  const edgeBins = new Map<number, number>()
  const probe = (x: number, y: number) => {
    const i = y * thumb.width + x
    const key =
      ((thumb.rgb[i * 3] >> 4) << 8) |
      ((thumb.rgb[i * 3 + 1] >> 4) << 4) |
      (thumb.rgb[i * 3 + 2] >> 4)
    edgeBins.set(key, (edgeBins.get(key) ?? 0) + 1)
    if (thumb.rgb[i * 3] > 240 && thumb.rgb[i * 3 + 1] > 240 && thumb.rgb[i * 3 + 2] > 240)
      edgeWhite++
    edgeSamples++
  }
  for (let x = 0; x < thumb.width; x++) {
    probe(x, 0)
    probe(x, thumb.height - 1)
  }
  for (let y = 1; y < thumb.height - 1; y++) {
    probe(0, y)
    probe(thumb.width - 1, y)
  }

  return {
    perceptualHash: dHash(thumb, 8, 8),
    detailHash: dHash(thumb, 16, 16),
    colorSignature: colorSignature(thumb),
    blurScore: sharpness(thumb),
    colorBins,
    whiteFraction: samples ? white / samples : 0,
    transparentFraction: alphaSamples ? transparent / alphaSamples : 0,
    skinFraction: samples ? skin / samples : 0,
    edgeWhiteFraction: edgeSamples ? edgeWhite / edgeSamples : 0,
    edgePlainShare: edgeSamples ? Math.max(...edgeBins.values()) / edgeSamples : 0
  }
}
