/**
 * Looking at pictures: size, fingerprint and scaling (agents/ASSETS.md §2.1). The work sits behind the
 * `ImageTools` port so the library never imports Electron:
 *   - `createPureImageTools()`   decodes in plain JS (the extraction service's decoders + resvg). Always works.
 *   - `createNativeImageTools()` uses Electron's `nativeImage` for PNG and JPEG (fast, any size) and the pure
 *     tools for everything else (nativeImage cannot read SVG, WebP or GIF reliably).
 *   - `createElectronImageTools()` picks the native one lazily when Electron is there, else the pure one.
 */
import type { NativeImage } from 'electron'
import { ASSET_MIME, type AssetFileExt } from '@shared/assets/types'
import { differenceHash, luma } from '@shared/assets/hash'
import { LIBRARY_SVG, sanitiseSvg } from '@shared/deck/svg'
import { resizeOverWhite } from '../../import/assets/analysis'
import { decodeImage, headerSize } from '../../import/assets/decode'
import { encodeRaster } from '../../import/assets/png'
import type { ImageMime, Raster } from '../../import/assets/types'
import { MAX_ASSET_SIDE } from './storeParts'

export const THUMB_SIDE = 256
export const PREVIEW_SIDE = 768
/** SVG sizes are reported as a viewBox scaled so the long side is this many pixels (Asset.file.width). */
export const SVG_LONG_SIDE = 1024
/** Pictures with more pixels than this are not decoded in plain JS. */
const MAX_PURE_PIXELS = 40_000_000
const MIME = ASSET_MIME as Readonly<Record<AssetFileExt, ImageMime>>

export interface Inspected {
  width: number
  height: number
  /** 64-bit difference hash, 16 hex characters; null when the pixels could not be read. */
  phash: string | null
}

export interface Scaled {
  png: Uint8Array
  width: number
  height: number
}

export interface ImageTools {
  /** Size and fingerprint; null when the bytes are not a picture the app can measure. */
  inspect(bytes: Uint8Array, ext: AssetFileExt): Promise<Inspected | null>
  /** A PNG whose long side is `maxSide` (rasters are never enlarged, vectors are drawn at that size). */
  scale(bytes: Uint8Array, ext: AssetFileExt, maxSide: number): Promise<Scaled | null>
}

// ---- plain JS ----------------------------------------------------------------------------------

/** Area-average shrink with premultiplied alpha, so transparent edges do not turn dark. */
export function shrinkRaster(raster: Raster, tw: number, th: number): Raster {
  const { width: w, height: h, data } = raster
  const out = new Uint8ClampedArray(tw * th * 4)
  for (let y = 0; y < th; y++) {
    const y0 = Math.floor((y * h) / th)
    const y1 = Math.min(h, Math.max(y0 + 1, Math.floor(((y + 1) * h) / th)))
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor((x * w) / tw)
      const x1 = Math.min(w, Math.max(x0 + 1, Math.floor(((x + 1) * w) / tw)))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0, p = (yy * w + x0) * 4; xx < x1; xx++, p += 4) {
          const alpha = data[p + 3]!
          r += data[p]! * alpha
          g += data[p + 1]! * alpha
          b += data[p + 2]! * alpha
          a += alpha
          n++
        }
      }
      const o = (y * tw + x) * 4
      if (n > 0 && a > 0) {
        out[o] = r / a
        out[o + 1] = g / a
        out[o + 2] = b / a
        out[o + 3] = a / n
      }
    }
  }
  return { width: tw, height: th, data: out }
}

/** dHash of a raster: shrunk to 9x8 over white, grey values, then `differenceHash`. */
export function hashRaster(raster: Raster): string {
  const grid = resizeOverWhite(raster, 9, 8)
  const gray = new Uint8Array(72)
  for (let i = 0; i < 72; i++) {
    gray[i] = luma(grid.rgb[i * 3]!, grid.rgb[i * 3 + 1]!, grid.rgb[i * 3 + 2]!)
  }
  return differenceHash(gray)
}

const fitSize = (w: number, h: number, side: number, enlarge: boolean) => {
  const k = enlarge ? side / Math.max(w, h) : Math.min(1, side / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}

async function renderSvg(svg: string, width: number) {
  const { Resvg } = await import('@resvg/resvg-js')
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: Math.max(1, Math.round(width)) },
    font: { loadSystemFonts: true, defaultFontFamily: 'Arial' }
  }).render()
}

async function svgSize(svg: string): Promise<{ width: number; height: number }> {
  const { Resvg } = await import('@resvg/resvg-js')
  const probe = new Resvg(svg)
  return { width: probe.width, height: probe.height }
}

/**
 * The markup that is safe to draw: the library keeps the picture exactly as it came, so every rendering path
 * (size, fingerprint, thumbnails, references for Claude) goes through the sanitiser first. Null when it refuses.
 */
export function renderableSvg(bytes: Uint8Array): string | null {
  const clean = sanitiseSvg(new TextDecoder().decode(bytes), LIBRARY_SVG)
  return clean.ok ? clean.svg : null
}

async function inspectSvg(bytes: Uint8Array): Promise<Inspected | null> {
  try {
    const svg = renderableSvg(bytes)
    if (!svg) return null
    const size = await svgSize(svg)
    if (!(size.width > 0 && size.height > 0)) return null
    const grid = fitSize(size.width, size.height, 64, true)
    const drawn = await renderSvg(svg, grid.width)
    const raster = {
      width: drawn.width,
      height: drawn.height,
      data: new Uint8ClampedArray(drawn.pixels)
    }
    return { ...fitSize(size.width, size.height, SVG_LONG_SIDE, true), phash: hashRaster(raster) }
  } catch {
    return null
  }
}

async function scaleSvg(bytes: Uint8Array, maxSide: number): Promise<Scaled | null> {
  try {
    const svg = renderableSvg(bytes)
    if (!svg) return null
    const size = await svgSize(svg)
    if (!(size.width > 0 && size.height > 0)) return null
    const target = fitSize(size.width, size.height, maxSide, true)
    const drawn = await renderSvg(svg, target.width)
    return { png: new Uint8Array(drawn.asPng()), width: drawn.width, height: drawn.height }
  } catch {
    return null
  }
}

/** Plain-JS tools: PNG and JPEG with the built-in decoders, GIF/WebP/SVG with resvg. */
export function createPureImageTools(): ImageTools {
  const decode = async (bytes: Uint8Array, ext: AssetFileExt): Promise<Raster | null> => {
    const mime = MIME[ext]
    const size = headerSize(bytes, mime)
    if (size && size.width * size.height > MAX_PURE_PIXELS) return null
    return decodeImage(bytes, mime)
  }
  return {
    async inspect(bytes, ext) {
      if (ext === '.svg') return inspectSvg(bytes)
      const header = headerSize(bytes, MIME[ext])
      const raster = await decode(bytes, ext)
      if (raster) return { width: raster.width, height: raster.height, phash: hashRaster(raster) }
      return header && header.width > 0 && header.height > 0 ? { ...header, phash: null } : null
    },
    async scale(bytes, ext, maxSide) {
      if (ext === '.svg') return scaleSvg(bytes, maxSide)
      const raster = await decode(bytes, ext)
      if (!raster) return null
      const to = fitSize(raster.width, raster.height, maxSide, false)
      const small =
        to.width === raster.width && to.height === raster.height
          ? raster
          : shrinkRaster(raster, to.width, to.height)
      return { png: encodeRaster(small), width: small.width, height: small.height }
    }
  }
}

// ---- Electron's nativeImage --------------------------------------------------------------------

/** The slice of `electron.nativeImage` the tools use (so tests can pass a fake). */
export interface NativeImageApi {
  createFromBuffer(buffer: Buffer): NativeImage
}

const NATIVE_EXTENSIONS: readonly AssetFileExt[] = ['.png', '.jpg']

/** Hash from an Electron bitmap (BGRA on Windows): shrink to 9x8, composite over white, dHash. */
function hashNative(image: NativeImage): string {
  const grid = image.resize({ width: 9, height: 8, quality: 'good' }).toBitmap()
  const gray = new Uint8Array(72)
  for (let i = 0; i < 72; i++) {
    const a = (grid[i * 4 + 3] ?? 255) / 255
    const over = (c: number): number => c * a + 255 * (1 - a)
    gray[i] = luma(over(grid[i * 4 + 2] ?? 0), over(grid[i * 4 + 1] ?? 0), over(grid[i * 4] ?? 0))
  }
  return differenceHash(gray)
}

/** PNG and JPEG through `nativeImage`; any other format, and any picture it cannot read, goes to `fallback`. */
export function createNativeImageTools(
  native: NativeImageApi,
  fallback: ImageTools = createPureImageTools()
): ImageTools {
  const open = (bytes: Uint8Array, ext: AssetFileExt): NativeImage | null => {
    if (!NATIVE_EXTENSIONS.includes(ext)) return null
    // The header is read first: nativeImage would decode a huge or forged picture into memory before we could look.
    const header = headerSize(bytes, MIME[ext])
    if (!header || header.width < 1 || header.height < 1) return null
    if (header.width * header.height > MAX_PURE_PIXELS) return null
    if (header.width > MAX_ASSET_SIDE || header.height > MAX_ASSET_SIDE) return null
    try {
      const image = native.createFromBuffer(Buffer.from(bytes))
      return image.isEmpty() ? null : image
    } catch {
      return null
    }
  }
  return {
    async inspect(bytes, ext) {
      const image = open(bytes, ext)
      if (!image) return fallback.inspect(bytes, ext)
      try {
        const { width, height } = image.getSize()
        return { width, height, phash: hashNative(image) }
      } catch {
        return fallback.inspect(bytes, ext)
      }
    },
    async scale(bytes, ext, maxSide) {
      const image = open(bytes, ext)
      if (!image) return fallback.scale(bytes, ext, maxSide)
      try {
        const size = image.getSize()
        const to = fitSize(size.width, size.height, maxSide, false)
        const small =
          to.width === size.width && to.height === size.height
            ? image
            : image.resize({ width: to.width, height: to.height, quality: 'best' })
        const out = small.getSize()
        return { png: new Uint8Array(small.toPNG()), width: out.width, height: out.height }
      } catch {
        return fallback.scale(bytes, ext, maxSide)
      }
    }
  }
}

/** The tools for the running app: nativeImage when Electron provides it, plain JS otherwise (tests, scripts). */
export function createElectronImageTools(): ImageTools {
  const pure = createPureImageTools()
  let tools: Promise<ImageTools> | undefined
  const load = (): Promise<ImageTools> =>
    (tools ??= import('electron')
      .then((mod) => {
        const native = (mod as { nativeImage?: NativeImageApi }).nativeImage
        return native ? createNativeImageTools(native, pure) : pure
      })
      .catch(() => pure))
  return {
    inspect: async (bytes, ext) => (await load()).inspect(bytes, ext),
    scale: async (bytes, ext, maxSide) => (await load()).scale(bytes, ext, maxSide)
  }
}
