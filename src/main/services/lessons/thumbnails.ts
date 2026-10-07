/**
 * Home's thumbnail: the first slide as a 480x270 PNG (`thumb.png`), drawn through the renderer port after a
 * change. Requests are coalesced per lesson (only the newest is drawn), skipped when the first slide did not
 * change, and a failing renderer never fails a save (the card just keeps its old picture).
 */
import type { Deck } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import type { LessonStore } from './store'
import type { Logger, SlideRendererPort } from './types'

export const THUMB_WIDTH = 480
export const THUMB_HEIGHT = 270

export interface ThumbnailRequest {
  lessonId: string
  deck: Deck
  style: StyleProfile | null
  readAsset(assetId: string): Promise<Uint8Array | undefined>
}

export class ThumbnailService {
  private readonly latest = new Map<string, ThumbnailRequest>()
  private readonly running = new Map<string, Promise<void>>()
  private readonly drawn = new Map<string, string>()

  constructor(
    private readonly deps: {
      store: LessonStore
      renderer: SlideRendererPort | undefined
      log: Logger
      /** Called after a thumbnail was written or removed. */
      onUpdated(lessonId: string): void
    }
  ) {}

  /** Asks for a fresh thumbnail; returns at once. */
  request(request: ThumbnailRequest): void {
    if (!this.deps.renderer) return
    this.latest.set(request.lessonId, request)
    if (!this.running.has(request.lessonId)) {
      const loop = this.drain(request.lessonId).finally(() => this.running.delete(request.lessonId))
      this.running.set(request.lessonId, loop)
    }
  }

  /** Resolves when every requested thumbnail has been dealt with (for tests and shutdown). */
  async flush(): Promise<void> {
    while (this.running.size > 0) await Promise.all([...this.running.values()])
  }

  private async drain(lessonId: string): Promise<void> {
    for (;;) {
      const request = this.latest.get(lessonId)
      if (!request) return
      this.latest.delete(lessonId)
      try {
        await this.draw(request)
      } catch (error) {
        this.deps.log.warn(`Thumbnail for ${lessonId} failed: ${String(error)}`)
      }
    }
  }

  private async draw({ lessonId, deck, style, readAsset }: ThumbnailRequest): Promise<void> {
    const first = deck.slides[0]
    if (!first) {
      this.drawn.delete(lessonId)
      await this.deps.store.clearThumb(lessonId)
      this.deps.onUpdated(lessonId)
      return
    }
    const key = JSON.stringify([first, style?.id ?? null, style?.version ?? null])
    if (this.drawn.get(lessonId) === key) return
    const png = await this.deps.renderer!.renderSlidePng({
      slide: first,
      style,
      width: THUMB_WIDTH,
      height: THUMB_HEIGHT,
      readAsset
    })
    await this.deps.store.writeThumb(lessonId, png)
    this.drawn.set(lessonId, key)
    this.deps.onUpdated(lessonId)
  }
}
