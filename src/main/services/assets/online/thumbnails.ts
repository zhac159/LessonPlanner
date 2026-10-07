/**
 * Search-result thumbnails for the offline renderer: main downloads each one (small files, safe download rules),
 * keeps pictures that are already small as they are and scales bigger ones to 320 px, and hands back data URLs.
 * A thumbnail that fails is simply missing (the card draws its placeholder); it never fails the search.
 */
import { ASSET_MIME, type AssetFileExt } from '@shared/assets/types'
import { headerSize } from '../../../import/assets/decode'
import { downloadImage } from '../../imageProviders/download'
import type { FetchFn } from '../../imageProviders/types'
import { toDataUrl, type ImageTools } from '../thumbs'

export const ONLINE_THUMB_SIDE = 320
const KEEP_IF_UNDER_BYTES = 150 * 1024
const KEEP_IF_SIDE_UNDER = 700
const CACHE_LIMIT = 300

export interface OnlineThumbDeps {
  fetchFn: FetchFn
  userAgent?: string
  tools: ImageTools
}

/** Runs `task` over `items` with at most `limit` in flight, keeping the order of the results. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    for (let at = next++; at < items.length; at = next++) out[at] = await task(items[at]!)
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

export class OnlineThumbnails {
  private readonly cache = new Map<string, string | null>()

  constructor(private readonly deps: OnlineThumbDeps) {}

  /** A data URL for the picture at `url`, or null. Results (also failures) are remembered for the session. */
  async dataUrl(url: string, signal?: AbortSignal): Promise<string | null> {
    if (this.cache.has(url)) return this.cache.get(url) ?? null
    const value = await this.load(url, signal)
    if (!signal?.aborted) {
      this.cache.set(url, value)
      while (this.cache.size > CACHE_LIMIT)
        this.cache.delete(this.cache.keys().next().value as string)
    }
    return value
  }

  private async load(url: string, signal?: AbortSignal): Promise<string | null> {
    try {
      const image = await downloadImage(url, {
        fetchFn: this.deps.fetchFn,
        userAgent: this.deps.userAgent,
        maxBytes: 3 * 1024 * 1024,
        timeoutMs: 12_000,
        signal
      })
      const size = headerSize(image.bytes, image.mime)
      const small =
        image.bytes.byteLength <= KEEP_IF_UNDER_BYTES &&
        size !== null &&
        Math.max(size.width, size.height) <= KEEP_IF_SIDE_UNDER
      if (small) return `data:${image.mime};base64,${Buffer.from(image.bytes).toString('base64')}`
      const ext = `.${image.extension}` as AssetFileExt
      if (!(ext in ASSET_MIME)) return null
      const scaled = await this.deps.tools.scale(image.bytes, ext, ONLINE_THUMB_SIDE)
      return scaled ? toDataUrl(scaled.png) : null
    } catch {
      return null
    }
  }
}
