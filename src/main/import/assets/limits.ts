/**
 * Safety limits for reading files we did not write (decks, PDFs, pictures). A tiny file can inflate to gigabytes
 * (a "decompression bomb"), so every inflate is capped on the bytes actually produced, never on a size the file
 * claims for itself.
 */
import { ImportError } from '../errors'

/** The one message the teacher sees when a limit is hit. */
export const TOO_LARGE_TO_READ = 'This file is too large to read safely'

/** Pictures with more pixels than this are never decoded (also the default `maxPixels`). */
export const MAX_DECODE_PIXELS = 40_000_000

/** Thrown when a limit is hit; an ImportError with code 'too-large' but its own readable reason. */
export class UnsafeFileError extends ImportError {
  constructor() {
    super('too-large')
    this.message = TOO_LARGE_TO_READ
    this.name = 'UnsafeFileError'
  }
}

export const isUnsafeFileError = (error: unknown): error is UnsafeFileError =>
  error instanceof UnsafeFileError

export interface ZipLimits {
  /** Largest picture file inside a deck, in bytes after inflating (default 50 MB). */
  mediaBytes: number
  /** Largest XML part, in bytes after inflating (default 5 MB). */
  xmlBytes: number
  /** All inflated bytes read from one deck (default 500 MB). */
  totalBytes: number
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  mediaBytes: 50 * 1024 * 1024,
  xmlBytes: 5 * 1024 * 1024,
  totalBytes: 500 * 1024 * 1024
}

/**
 * The most bytes the zlib stream of a PNG can hold: every (sub)image row has one filter byte plus its pixels.
 * Anything longer is padding or a bomb. Returns null for an IHDR that makes no sense.
 */
export function pngInflatedLimit(
  width: number,
  height: number,
  depth: number,
  colorType: number,
  interlace: number
): number | null {
  const channels = [1, 0, 3, 1, 2, 0, 4][colorType]
  if (!channels || !width || !height || ![1, 2, 4, 8, 16].includes(depth)) return null
  const bits = channels * depth
  const rows = (w: number, h: number): number => h * (1 + Math.ceil((w * bits) / 8))
  if (interlace === 0) return rows(width, height)
  const passes = [
    [0, 0, 8, 8],
    [4, 0, 8, 8],
    [0, 4, 4, 8],
    [2, 0, 4, 4],
    [0, 2, 2, 4],
    [1, 0, 2, 2],
    [0, 1, 1, 2]
  ]
  let total = 0
  for (const [x0, y0, dx, dy] of passes) {
    const pw = Math.ceil((width - x0) / dx)
    const ph = Math.ceil((height - y0) / dy)
    if (pw > 0 && ph > 0) total += rows(pw, ph)
  }
  return total
}
