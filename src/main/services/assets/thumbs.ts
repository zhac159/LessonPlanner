/**
 * Thumbnails and previews of library pictures: `library/<id>/thumb.png` (256 px, made when a picture is saved
 * and again when it is missing) and 768 px previews made on demand. Both reach the renderer as data URLs
 * because the renderer is offline. Looking at the pixels is `ImageTools` (./imageTools).
 */
import { readFile, rm } from 'node:fs/promises'
import type { Asset } from '@shared/assets/types'
import { writeFileAtomic } from '../../export/save'
import { PREVIEW_SIDE, THUMB_SIDE, type ImageTools } from './imageTools'

export * from './imageTools'

export const toDataUrl = (png: Uint8Array): string =>
  `data:image/png;base64,${Buffer.from(png).toString('base64')}`

export interface ThumbnailDeps {
  tools: ImageTools
  /** `library/<id>/thumb.png`. */
  thumbPath(assetId: string): string
  /** The stored original; undefined when the file is gone. */
  readOriginal(asset: Asset): Promise<Uint8Array | undefined>
  warn?(message: string): void
}

const CACHE_LIMIT = 400

/** Thumbnails (on disk, regenerated when missing) and previews (made on demand), served as data URLs. */
export class ThumbnailService {
  private readonly thumbs = new Map<string, string>()
  private readonly previews = new Map<string, string>()
  private readonly pending = new Map<string, Promise<string | null>>()

  constructor(private readonly deps: ThumbnailDeps) {}

  private key = (asset: Asset): string => `${asset.id}:${asset.file.sha256}`

  private remember(cache: Map<string, string>, key: string, url: string): void {
    cache.delete(key)
    cache.set(key, url)
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
  }

  /** (Re)writes `thumb.png` from the original; resolves to the data URL, or null when it cannot be made. */
  async make(asset: Asset, bytes?: Uint8Array): Promise<string | null> {
    try {
      const original = bytes ?? (await this.deps.readOriginal(asset))
      const scaled = original && (await this.deps.tools.scale(original, asset.file.ext, THUMB_SIDE))
      if (!scaled) return null
      await writeFileAtomic(this.deps.thumbPath(asset.id), scaled.png)
      const url = toDataUrl(scaled.png)
      this.remember(this.thumbs, this.key(asset), url)
      return url
    } catch (error) {
      this.deps.warn?.(`Thumbnail for ${asset.id} failed: ${String(error)}`)
      return null
    }
  }

  /** The 256 px thumbnail as a data URL (from memory, then disk, then made again). */
  thumbDataUrl(asset: Asset): Promise<string | null> {
    const key = this.key(asset)
    const hit = this.thumbs.get(key)
    if (hit) return Promise.resolve(hit)
    const running = this.pending.get(key)
    if (running) return running
    const job = (async () => {
      try {
        const url = toDataUrl(await readFile(this.deps.thumbPath(asset.id)))
        this.remember(this.thumbs, key, url)
        return url
      } catch {
        return this.make(asset)
      }
    })().finally(() => this.pending.delete(key))
    this.pending.set(key, job)
    return job
  }

  /** The 768 px preview for the detail pane (not stored on disk). */
  async previewDataUrl(asset: Asset): Promise<string | null> {
    const key = this.key(asset)
    const hit = this.previews.get(key)
    if (hit) return hit
    try {
      const original = await this.deps.readOriginal(asset)
      const scaled =
        original && (await this.deps.tools.scale(original, asset.file.ext, PREVIEW_SIDE))
      if (!scaled) return this.thumbDataUrl(asset)
      const url = toDataUrl(scaled.png)
      this.remember(this.previews, key, url)
      return url
    } catch (error) {
      this.deps.warn?.(`Preview for ${asset.id} failed: ${String(error)}`)
      return this.thumbDataUrl(asset)
    }
  }

  /** Forgets everything about an asset (its file changed or it was deleted). */
  async forget(assetId: string, removeFile = false): Promise<void> {
    for (const cache of [this.thumbs, this.previews]) {
      for (const key of [...cache.keys()]) if (key.startsWith(`${assetId}:`)) cache.delete(key)
    }
    if (removeFile) await rm(this.deps.thumbPath(assetId), { force: true })
  }
}
