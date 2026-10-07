/**
 * Pixel decoding for the formats that show up in decks, with no new dependencies:
 * PNG (own decoder), JPEG (the decoder shipped inside pdfjs-dist), GIF/WebP/BMP/SVG (rendered by the installed
 * @resvg/resvg-js, which embeds them in a tiny SVG). EMF/WMF/TIFF are not decodable and return null.
 */
import { LIBRARY_SVG, sanitiseSvg } from '@shared/deck/svg'
import { MAX_DECODE_PIXELS } from './limits'
import { decodePng, isPng, pngSize } from './png'
import type { ImageDecoder, ImageMime, Raster } from './types'

/** The mime type from the first bytes of a file, or undefined for anything unknown. */
export function sniffMime(bytes: Uint8Array): ImageMime | undefined {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (isPng(bytes)) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (ascii(0, 3) === 'GIF') return 'image/gif'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (ascii(0, 2) === 'BM') return 'image/bmp'
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[3] === 0x2a)
  )
    return 'image/tiff'
  if (bytes[0] === 0xd7 && bytes[1] === 0xcd && bytes[2] === 0xc6 && bytes[3] === 0x9a)
    return 'image/x-wmf'
  if (bytes.length > 44 && bytes[0] === 1 && bytes[1] === 0 && ascii(40, 44) === ' EMF')
    return 'image/x-emf'
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg')))
    return 'image/svg+xml'
  return undefined
}

/** The mime type for a media file name (`image1.PNG`), or undefined when the extension is not an image. */
export function mimeFromName(name: string): ImageMime | undefined {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase()
  const map: Record<string, ImageMime> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    jpe: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    svg: 'image/svg+xml',
    emf: 'image/x-emf',
    wmf: 'image/x-wmf'
  }
  return ext ? map[ext] : undefined
}

export interface JpegInfo {
  width: number
  height: number
  components: number
}

/** Size and number of colour components from the first start-of-frame marker. */
export function jpegInfo(bytes: Uint8Array): JpegInfo | null {
  let i = 2
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++
      continue
    }
    const marker = bytes[i + 1]
    if (marker === 0xff) {
      i++
      continue
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3]
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
        components: bytes[i + 9]
      }
    }
    i += 2 + length
  }
  return null
}

/** Natural size from the header, for the formats whose size is cheap to read. */
export function headerSize(
  bytes: Uint8Array,
  mime: ImageMime
): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  try {
    if (mime === 'image/png') return pngSize(bytes)
    if (mime === 'image/jpeg') return jpegInfo(bytes)
    if (mime === 'image/gif')
      return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
    if (mime === 'image/bmp')
      return { width: Math.abs(view.getInt32(18, true)), height: Math.abs(view.getInt32(22, true)) }
    if (mime === 'image/webp') {
      const kind = String.fromCharCode(...bytes.subarray(12, 16))
      if (kind === 'VP8X')
        return {
          width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
          height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16))
        }
      if (kind === 'VP8 ')
        return {
          width: view.getUint16(26, true) & 0x3fff,
          height: view.getUint16(28, true) & 0x3fff
        }
      if (kind === 'VP8L') {
        const bits = view.getUint32(21, true)
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
      }
    }
  } catch {
    return null
  }
  return null
}

type ResvgModule = typeof import('@resvg/resvg-js')
let resvg: Promise<ResvgModule> | undefined
const loadResvg = (): Promise<ResvgModule> => (resvg ??= import('@resvg/resvg-js'))

interface JpegDecoder {
  parse(data: Uint8Array): void
  width: number
  height: number
  getData(options: { width: number; height: number; forceRGBA: boolean }): Uint8ClampedArray
}
let jpeg: Promise<new () => JpegDecoder> | undefined
const loadJpeg = (): Promise<new () => JpegDecoder> =>
  (jpeg ??= import('pdfjs-dist/legacy/image_decoders/pdf.image_decoders.mjs').then(
    (mod) => (mod as unknown as { JpegImage: new () => JpegDecoder }).JpegImage
  ))

async function decodeWithResvg(bytes: Uint8Array, mime: ImageMime): Promise<Raster | null> {
  const { Resvg } = await loadResvg()
  let svg: string
  let fitWidth: number | undefined
  if (mime === 'image/svg+xml') {
    // A deck's own SVG is drawn only after the sanitiser (no embedded pictures or file links); the bytes stay as stored.
    const clean = sanitiseSvg(new TextDecoder().decode(bytes), LIBRARY_SVG)
    if (!clean.ok) return null
    svg = clean.svg
    fitWidth = 256
  } else {
    const size = headerSize(bytes, mime)
    if (!size || size.width < 1 || size.height < 1) return null
    const href = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"><image href="${href}" width="${size.width}" height="${size.height}"/></svg>`
  }
  const rendered = new Resvg(
    svg,
    fitWidth ? { fitTo: { mode: 'width', value: fitWidth } } : undefined
  ).render()
  return {
    width: rendered.width,
    height: rendered.height,
    data: new Uint8ClampedArray(rendered.pixels)
  }
}

/** The default decoder. Never throws: undecodable input gives null. */
export const decodeImage: ImageDecoder = async (bytes, mime) => {
  try {
    // The header is read first: a picture over the pixel cap is never handed to a decoder.
    const header = mime === 'image/svg+xml' ? null : headerSize(bytes, mime)
    if (header && header.width * header.height > MAX_DECODE_PIXELS) return null
    if (mime === 'image/png') return decodePng(bytes)
    if (mime === 'image/jpeg') {
      const Jpeg = await loadJpeg()
      const image = new Jpeg()
      image.parse(bytes)
      const data = image.getData({ width: image.width, height: image.height, forceRGBA: true })
      return { width: image.width, height: image.height, data: new Uint8ClampedArray(data) }
    }
    if (
      mime === 'image/gif' ||
      mime === 'image/webp' ||
      mime === 'image/bmp' ||
      mime === 'image/svg+xml'
    )
      return await decodeWithResvg(bytes, mime)
  } catch {
    return null
  }
  return null
}
