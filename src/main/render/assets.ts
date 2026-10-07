/** Prepares lesson assets for the render page: only what the slide uses, as `data:` URLs. */
import type { Slide } from '@shared/deck/types'

const startsWith = (bytes: Uint8Array, ...sig: number[]): boolean =>
  bytes.length >= sig.length && sig.every((value, i) => bytes[i] === value)

const ascii = (bytes: Uint8Array, from: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(from, from + length))

/** The image type of some bytes by their signature (`undefined` when it is not a picture the page can show). */
export function sniffImageMime(bytes: Uint8Array): string | undefined {
  if (startsWith(bytes, 0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (startsWith(bytes, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (startsWith(bytes, 0x47, 0x49, 0x46, 0x38)) return 'image/gif'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp'
  const head = ascii(bytes, 0, 512).trimStart()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return 'image/svg+xml'
  }
  return undefined
}

/** Ids of the lesson assets the slide's pictures point at. */
export function assetIdsUsedBy(slide: Slide): string[] {
  const ids = new Set<string>()
  for (const element of slide.elements) {
    if (element.type === 'image' && element.assetId) ids.add(element.assetId)
  }
  return [...ids]
}

/**
 * `data:` URLs for the assets the slide uses. An asset that is missing or not a recognisable picture is
 * left out, so the page shows the image placeholder instead of a broken picture.
 */
export function assetDataUrls(
  slide: Slide,
  assets: Record<string, Uint8Array> | undefined
): Record<string, string> {
  const urls: Record<string, string> = {}
  for (const id of assetIdsUsedBy(slide)) {
    const bytes = assets?.[id]
    const mime = bytes ? sniffImageMime(bytes) : undefined
    if (bytes && mime) urls[id] = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
  }
  return urls
}
