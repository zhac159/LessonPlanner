/**
 * Cheap, local picture fingerprints for the review step: near-duplicate detection (the same logo found in 24
 * decks, an older version of it) and a blur check. The caller (main, using Electron's nativeImage) downsizes
 * the picture and hands over grey-scale pixels; everything here is pure arithmetic (agents/ASSETS.md §5.1, §5.2).
 */

/** Hash grid: 9 columns x 8 rows of grey values -> 64 bits. */
export const HASH_WIDTH = 9
export const HASH_HEIGHT = 8

/** Two pictures whose hashes differ in at most this many bits count as the same picture. */
export const NEAR_DUPLICATE_BITS = 6
/** ...and "a similar picture, probably another version" up to this many. */
export const SIMILAR_BITS = 14

/** Grey value (0..255) of a pixel using the usual luma weights. */
export const luma = (r: number, g: number, b: number): number =>
  Math.round(0.299 * r + 0.587 * g + 0.114 * b)

/** Grey values from RGBA or BGRA pixels (Electron's `toBitmap()` is BGRA on Windows). */
export function grayFromPixels(
  pixels: ArrayLike<number>,
  order: 'rgba' | 'bgra' = 'rgba'
): Uint8Array {
  const out = new Uint8Array(Math.floor(pixels.length / 4))
  for (let i = 0; i < out.length; i += 1) {
    const p = i * 4
    const [r, b] =
      order === 'rgba' ? [pixels[p] ?? 0, pixels[p + 2] ?? 0] : [pixels[p + 2] ?? 0, pixels[p] ?? 0]
    out[i] = luma(r, pixels[p + 1] ?? 0, b)
  }
  return out
}

/** Difference hash (dHash): bit = "this pixel is brighter than the one to its right". 16 hex characters. */
export function differenceHash(gray: ArrayLike<number>): string {
  if (gray.length < HASH_WIDTH * HASH_HEIGHT) {
    throw new Error(
      `differenceHash needs ${HASH_WIDTH * HASH_HEIGHT} grey values, got ${gray.length}`
    )
  }
  let hex = ''
  for (let row = 0; row < HASH_HEIGHT; row += 1) {
    let byte = 0
    for (let col = 0; col < HASH_WIDTH - 1; col += 1) {
      const here = gray[row * HASH_WIDTH + col] ?? 0
      const next = gray[row * HASH_WIDTH + col + 1] ?? 0
      byte = (byte << 1) | (here > next ? 1 : 0)
    }
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

const BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4]

/** Number of differing bits between two 16-character hashes (Infinity when either is malformed). */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return Infinity
  let bits = 0
  for (let i = 0; i < 16; i += 1) {
    const left = Number.parseInt(a[i] ?? '', 16)
    const right = Number.parseInt(b[i] ?? '', 16)
    if (Number.isNaN(left) || Number.isNaN(right)) return Infinity
    bits += BITS[left ^ right] ?? 0
  }
  return bits
}

export const isNearDuplicate = (a: string, b: string): boolean =>
  hammingDistance(a, b) <= NEAR_DUPLICATE_BITS

/** Similar enough to be another version of the same picture, but not the same one. */
export function isSimilar(a: string, b: string): boolean {
  const distance = hammingDistance(a, b)
  return distance > NEAR_DUPLICATE_BITS && distance <= SIMILAR_BITS
}

/** Variance of the Laplacian over a grey-scale picture: low means soft or blurry. Pictures under 3 px give 0. */
export function laplacianVariance(gray: ArrayLike<number>, width: number, height: number): number {
  if (width < 3 || height < 3 || gray.length < width * height) return 0
  let sum = 0
  let sumSquares = 0
  let count = 0
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x
      const value =
        4 * (gray[i] ?? 0) -
        (gray[i - 1] ?? 0) -
        (gray[i + 1] ?? 0) -
        (gray[i - width] ?? 0) -
        (gray[i + width] ?? 0)
      sum += value
      sumSquares += value * value
      count += 1
    }
  }
  const mean = sum / count
  return sumSquares / count - mean * mean
}

/**
 * Below this variance (measured on the picture resized to 256 px on its long side) a picture is "blurry".
 * A starting value to calibrate on her real decks (agents/ASSETS.md §5.1); flat colour logos and icons have
 * few edges at that size, so the check applies only to `photo` and `picture` kinds.
 */
export const BLUR_VARIANCE_THRESHOLD = 40
export const isBlurry = (variance: number): boolean => variance < BLUR_VARIANCE_THRESHOLD
