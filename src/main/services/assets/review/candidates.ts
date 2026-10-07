/**
 * Turning what the extraction service found into review candidates, and deciding what stays unticked and why
 * (agents/ASSETS.md §3.2, §5.1, §5.2). The functions are small and mostly pure; the service owns state and disk.
 */
import type { AssetKindHint } from '@shared/ai/types'
import type { AssetFileExt, AssetFoundIn, AssetKind } from '@shared/assets/types'
import type { LeftOutReason } from '@shared/contracts/assets'
import { decodeImage, encodePng, type FoundAsset, type ImageMime } from '../../../import/assets'
import type { ImageTools } from '../imageTools'
import { AssetError, prepareFile } from '../storeParts'
import type { ReviewBatchFile } from './ports'
import type { StoredCandidate } from './types'

/** The extractor's guess as an asset kind (Claude's answer, when there is one, wins). */
export const kindFromHint = (hint: AssetKindHint): AssetKind =>
  hint === 'other' ? 'picture' : hint

const MIME_EXT: Partial<Record<ImageMime, AssetFileExt>> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg'
}

export interface PictureFile {
  bytes: Uint8Array
  ext: AssetFileExt
  width: number
  height: number
  sha256: string
}

/**
 * The picture as the library can hold it: PNG, JPEG, GIF, WebP and SVG pass through byte for byte; BMP and TIFF
 * become a PNG; anything else (EMF, WMF, damaged) is null, as is a picture the library would refuse.
 */
export async function pictureFileOf(
  image: { bytes: Uint8Array; mime: ImageMime },
  tools: ImageTools
): Promise<PictureFile | null> {
  let bytes = image.bytes
  let ext = MIME_EXT[image.mime]
  if (!ext && (image.mime === 'image/bmp' || image.mime === 'image/tiff')) {
    const raster = await decodeImage(image.bytes, image.mime).catch(() => null)
    if (!raster) return null
    bytes = encodePng(raster.data, raster.width, raster.height, 'rgba')
    ext = '.png'
  }
  if (!ext) return null
  try {
    const prepared = await prepareFile(bytes, ext, tools)
    const { file } = prepared
    return {
      bytes: prepared.bytes,
      ext,
      width: file.width,
      height: file.height,
      sha256: file.sha256
    }
  } catch (error) {
    if (error instanceof AssetError) return null
    throw error
  }
}

/** One entry per deck the picture was seen in: the first page or slide where it appeared. */
export function foundInOf(
  found: Pick<FoundAsset, 'foundIn'>,
  styleId: string | null,
  files: ReadonlyArray<ReviewBatchFile>
): AssetFoundIn[] {
  return found.foundIn.map((entry) => ({
    styleId,
    sourceId: files.find((f) => f.name === entry.fileName)?.sourceId ?? entry.fileName,
    fileName: entry.fileName,
    page: entry.units[0] ?? null
  }))
}

/** The reason a candidate is unticked, or null. A library duplicate and possible pupils outrank everything. */
export function leftOutOf(
  candidate: StoredCandidate,
  byId: ReadonlyMap<string, StoredCandidate>
): { reason: LeftOutReason; ofName?: string } | null {
  if (candidate.duplicateOf) return { reason: 'duplicate', ofName: candidate.duplicateOf }
  if (candidate.extractorReason === 'pupils' || candidate.claudePupils) return { reason: 'pupils' }
  if (candidate.extractorReason && candidate.extractorReason !== 'older-version') {
    return { reason: candidate.extractorReason }
  }
  const better = candidate.olderOf ? byId.get(candidate.olderOf) : undefined
  if (candidate.extractorReason === 'older-version' || better) {
    return { reason: 'older-version', ofName: better?.name }
  }
  return null
}

/** The checkbox as the app proposes it. */
export const suggestedKeepOf = (
  candidate: StoredCandidate,
  byId: ReadonlyMap<string, StoredCandidate>
): boolean => leftOutOf(candidate, byId) === null

/** Recomputes `suggestedKeep` for all, moving `keep` along only where she has not touched the tick. */
export function refreshSuggestions(candidates: StoredCandidate[]): void {
  const byId = new Map(candidates.map((c) => [c.id, c]))
  for (const candidate of candidates) {
    const next = suggestedKeepOf(candidate, byId)
    if (candidate.keep === candidate.suggestedKeep) candidate.keep = next
    candidate.suggestedKeep = next
    // a picture already in the library can never be ticked
    if (candidate.duplicateOf) candidate.keep = false
  }
}
