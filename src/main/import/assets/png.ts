/** Minimal PNG encoder and decoder (zlib is built into Node). Lossless, no dependencies. */
import { deflateSync, inflateSync } from 'node:zlib'
import { MAX_DECODE_PIXELS, UnsafeFileError, pngInflatedLimit } from './limits'
import type { Raster } from './types'

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export const isPng = (bytes: Uint8Array): boolean => SIGNATURE.every((b, i) => bytes[i] === b)

let crcTable: Int32Array | undefined
function crc32(data: Uint8Array, start: number, end: number): number {
  if (!crcTable) {
    crcTable = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c
    }
  }
  let crc = -1
  for (let i = start; i < end; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

export function pngChunk(type: string, body: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + body.length)
  out.writeUInt32BE(body.length, 0)
  out.write(type, 4, 'latin1')
  out.set(body, 8)
  out.writeUInt32BE(crc32(out, 4, 8 + body.length), 8 + body.length)
  return out
}

export type PngColor = 'gray' | 'rgb' | 'rgba'

const CHANNELS: Record<PngColor, number> = { gray: 1, rgb: 3, rgba: 4 }
const COLOR_TYPE: Record<PngColor, number> = { gray: 0, rgb: 2, rgba: 6 }

/** Picks the filter (none, sub or up) with the smallest sum of absolute values for each row. */
function filterRows(pixels: Uint8Array, width: number, height: number, bpp: number): Buffer {
  const stride = width * bpp
  const out = Buffer.alloc((stride + 1) * height)
  const sub = new Uint8Array(stride)
  const up = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const row = y * stride
    let sumNone = 0
    let sumSub = 0
    let sumUp = 0
    for (let i = 0; i < stride; i++) {
      const cur = pixels[row + i]
      sub[i] = (cur - (i >= bpp ? pixels[row + i - bpp] : 0)) & 0xff
      up[i] = (cur - (y > 0 ? pixels[row - stride + i] : 0)) & 0xff
      sumNone += cur < 128 ? cur : 256 - cur
      sumSub += sub[i] < 128 ? sub[i] : 256 - sub[i]
      sumUp += up[i] < 128 ? up[i] : 256 - up[i]
    }
    const o = y * (stride + 1)
    if (sumSub <= sumNone && sumSub <= sumUp) {
      out[o] = 1
      out.set(sub, o + 1)
    } else if (sumUp < sumNone) {
      out[o] = 2
      out.set(up, o + 1)
    } else {
      out[o] = 0
      out.set(pixels.subarray(row, row + stride), o + 1)
    }
  }
  return out
}

/** Encodes 8-bit pixels (`gray`: 1 byte, `rgb`: 3, `rgba`: 4 per pixel) as a PNG. */
export function encodePng(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  color: PngColor = 'rgba'
): Uint8Array {
  const bpp = CHANNELS[color]
  if (pixels.length < width * height * bpp) throw new Error('encodePng: not enough pixel data')
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = COLOR_TYPE[color]
  const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.length)
  const raw = filterRows(bytes, width, height, bpp)
  return new Uint8Array(
    Buffer.concat([
      Buffer.from(SIGNATURE),
      pngChunk('IHDR', header),
      pngChunk('IDAT', deflateSync(raw, { level: 6 })),
      pngChunk('IEND', Buffer.alloc(0))
    ])
  )
}

/** Encodes RGBA, dropping the alpha channel when every pixel is opaque. */
export function encodeRaster(raster: Raster): Uint8Array {
  const { data, width, height } = raster
  let opaque = true
  for (let i = 3; i < width * height * 4; i += 4) {
    if (data[i] !== 255) {
      opaque = false
      break
    }
  }
  if (!opaque) return encodePng(data, width, height, 'rgba')
  const rgb = new Uint8Array(width * height * 3)
  for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
    rgb[i] = data[j]
    rgb[i + 1] = data[j + 1]
    rgb[i + 2] = data[j + 2]
  }
  return encodePng(rgb, width, height, 'rgb')
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Reverses the row filters of one (sub)image starting at `offset`; returns the bytes and the end offset. */
function unfilter(data: Uint8Array, offset: number, height: number, bpp: number, rowBytes: number) {
  if (offset + (rowBytes + 1) * height > data.length) throw new Error('Damaged PNG')
  const out = new Uint8Array(rowBytes * height)
  let pos = offset
  for (let y = 0; y < height; y++) {
    const type = data[pos++]
    const o = y * rowBytes
    for (let i = 0; i < rowBytes; i++) {
      const x = data[pos + i]
      const a = i >= bpp ? out[o + i - bpp] : 0
      const b = y > 0 ? out[o - rowBytes + i] : 0
      const c = y > 0 && i >= bpp ? out[o - rowBytes + i - bpp] : 0
      out[o + i] =
        type === 0
          ? x
          : type === 1
            ? x + a
            : type === 2
              ? x + b
              : type === 3
                ? x + ((a + b) >> 1)
                : x + paeth(a, b, c)
    }
    pos += rowBytes
  }
  return { out, end: pos }
}

const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2]
]

/** Width and height from the IHDR chunk, or null when this is not a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (!isPng(bytes) || bytes.length < 24) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

/**
 * Decodes any PNG (all colour types and bit depths, tRNS, Adam7) to RGBA. Throws on damaged files, and an
 * UnsafeFileError (before inflating anything) for a picture over `maxPixels` or one whose zlib data holds more than
 * its header says it can (a decompression bomb).
 */
export function decodePng(bytes: Uint8Array, maxPixels = MAX_DECODE_PIXELS): Raster {
  if (!isPng(bytes)) throw new Error('Not a PNG')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0
  let height = 0
  let depth = 8
  let colorType = 6
  let interlace = 0
  let palette: Uint8Array | undefined
  let trns: Uint8Array | undefined
  const idat: Uint8Array[] = []
  let pos = 8
  while (pos + 8 <= bytes.length) {
    const length = view.getUint32(pos)
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8))
    const body = bytes.subarray(pos + 8, pos + 8 + length)
    if (type === 'IHDR') {
      width = view.getUint32(pos + 8)
      height = view.getUint32(pos + 12)
      depth = bytes[pos + 16]
      colorType = bytes[pos + 17]
      interlace = bytes[pos + 20]
    } else if (type === 'PLTE') palette = body
    else if (type === 'tRNS') trns = body
    else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') break
    pos += 12 + length
  }
  if (!width || !height || idat.length === 0) throw new Error('Damaged PNG')
  const channels = [1, 0, 3, 1, 2, 0, 4][colorType]
  if (!channels) throw new Error('Unsupported PNG colour type')
  if (width * height > maxPixels) throw new UnsafeFileError()
  const limit = pngInflatedLimit(width, height, depth, colorType, interlace)
  if (limit === null) throw new Error('Damaged PNG')
  let inflated: Buffer
  try {
    inflated = inflateSync(Buffer.concat(idat), { maxOutputLength: limit })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE')
      throw new UnsafeFileError()
    throw error
  }
  const bitsPerPixel = channels * depth
  const bpp = Math.max(1, bitsPerPixel >> 3)
  const rgba = new Uint8ClampedArray(width * height * 4)
  const max = (1 << depth) - 1

  const sample = (row: Uint8Array, rowStart: number, index: number): number => {
    if (depth === 8) return row[rowStart + index]
    if (depth === 16) return (row[rowStart + index * 2] << 8) | row[rowStart + index * 2 + 1]
    const bit = index * depth
    return (row[rowStart + (bit >> 3)] >> (8 - depth - (bit & 7))) & max
  }
  const to8 = (value: number): number =>
    depth === 16 ? value >> 8 : depth === 8 ? value : Math.round((value * 255) / max)
  const matches16 = (offset: number, value: number): boolean =>
    trns !== undefined &&
    trns.length >= offset + 2 &&
    value === ((trns[offset] << 8) | trns[offset + 1])

  const paint = (
    pixels: Uint8Array,
    w: number,
    h: number,
    rowBytes: number,
    put: (x: number, y: number) => number
  ) => {
    for (let y = 0; y < h; y++) {
      const s = y * rowBytes
      for (let x = 0; x < w; x++) {
        const o = put(x, y) * 4
        let r: number
        let g: number
        let b: number
        let a = 255
        if (colorType === 3) {
          const idx = sample(pixels, s, x)
          r = palette?.[idx * 3] ?? 0
          g = palette?.[idx * 3 + 1] ?? 0
          b = palette?.[idx * 3 + 2] ?? 0
          a = trns && idx < trns.length ? trns[idx] : 255
        } else if (colorType === 0 || colorType === 4) {
          const v = sample(pixels, s, x * channels)
          r = g = b = to8(v)
          if (colorType === 4) a = to8(sample(pixels, s, x * 2 + 1))
          else if (matches16(0, v)) a = 0
        } else {
          const cr = sample(pixels, s, x * channels)
          const cg = sample(pixels, s, x * channels + 1)
          const cb = sample(pixels, s, x * channels + 2)
          r = to8(cr)
          g = to8(cg)
          b = to8(cb)
          if (colorType === 6) a = to8(sample(pixels, s, x * 4 + 3))
          else if (matches16(0, cr) && matches16(2, cg) && matches16(4, cb)) a = 0
        }
        rgba[o] = r
        rgba[o + 1] = g
        rgba[o + 2] = b
        rgba[o + 3] = a
      }
    }
  }

  if (interlace === 0) {
    const rowBytes = Math.ceil((width * bitsPerPixel) / 8)
    const { out } = unfilter(inflated, 0, height, bpp, rowBytes)
    paint(out, width, height, rowBytes, (x, y) => y * width + x)
  } else {
    let offset = 0
    for (const [x0, y0, dx, dy] of ADAM7) {
      const pw = Math.ceil((width - x0) / dx)
      const ph = Math.ceil((height - y0) / dy)
      if (pw <= 0 || ph <= 0) continue
      const rowBytes = Math.ceil((pw * bitsPerPixel) / 8)
      const { out, end } = unfilter(inflated, offset, ph, bpp, rowBytes)
      offset = end
      paint(out, pw, ph, rowBytes, (x, y) => (y0 + y * dy) * width + x0 + x * dx)
    }
  }
  return { width, height, data: rgba }
}
