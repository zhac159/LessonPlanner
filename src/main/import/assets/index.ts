/**
 * "Your assets" extraction service (agents/ASSETS.md). Pure and injectable: no Electron, no file system.
 *   extractAssets({ name, bytes })  -> every picture occurrence of a .pptx or .pdf, with placement and hints
 *   groupFindings(images)           -> the review list ("Found 12 · keeping 9")
 *   cropSymbolCards(image)          -> EXPERIMENTAL split of a card strip/grid bitmap into single cards
 */
import { ImportError } from '../errors'
import { MAX_DECODE_PIXELS } from './limits'
import { extractFromPdf } from './pdf'
import { extractFromPptx } from './pptx'
import type { ExtractOptions, ExtractionResult } from './types'

export { groupFindings, type GroupOptions } from './group'
export { cropSymbolCards, labelsFromText, splitCardsFromRaster } from './cards'
export { decodeImage, sniffMime } from './decode'
export { encodePng, decodePng } from './png'
export { isUnsafeFileError, TOO_LARGE_TO_READ, UnsafeFileError } from './limits'
export { hammingHex } from './analysis'
export type * from './types'

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

export interface AssetSourceFile {
  /** The teacher's file name, shown in "Where I looked". */
  name: string
  bytes: Uint8Array
}

export const DEFAULT_LIMITS = {
  maxImages: 400,
  maxUnits: 300,
  maxPixels: MAX_DECODE_PIXELS
} as const

/**
 * Reads the pictures out of a .pptx or .pdf. The format is detected from the first bytes (the extension only
 * decides between "old .ppt" and "password-protected .pptx"). Throws ImportError('password' | 'corrupt' |
 * 'empty' | 'unsupported' | 'old-ppt'); problems with single pictures become `warnings`.
 */
export async function extractAssets(
  file: AssetSourceFile,
  options: ExtractOptions = {}
): Promise<ExtractionResult> {
  const { bytes, name } = file
  const merged = { ...DEFAULT_LIMITS, ...options }
  const isPdf = String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-'
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  if (isPdf) return extractFromPdf(name, bytes, merged)
  if (isZip) return extractFromPptx(name, bytes, merged)
  if (OLE_MAGIC.every((b, i) => bytes[i] === b))
    throw new ImportError(/\.ppt$/i.test(name) ? 'old-ppt' : 'password')
  throw new ImportError(bytes.length === 0 ? 'corrupt' : 'unsupported')
}
