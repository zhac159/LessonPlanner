/**
 * The part of "Your assets" the lessons, generation and chat services use (agents/ASSETS.md §2.4, §4.2). A small
 * port instead of the assets service itself: tests give it a fake library, and nothing in these services knows
 * where pictures are stored, how they are named or how online results are fetched.
 */
import type { Asset } from '@shared/assets/types'
import type { Deck } from '@shared/deck/types'
import type { AssetSummary } from '@shared/contracts/assets'
import { fail, type Result } from '@shared/result'
import type { AssetsService } from '../assets/service'
import type { OnlineService } from '../assets/online/service'
import { rankAssets } from '../assets/suggest'

export interface LessonAssetsPort {
  /** Every picture in the library right now. */
  list(): readonly Asset[]
  get(assetId: string): Asset | undefined
  /** The stored original (the file as it was added). */
  readOriginal(assetId: string): Promise<Uint8Array | undefined>
  /** Moves `lastUsedAt` only. Never throws. */
  markUsed(assetId: string): Promise<void>
  summary(asset: Asset): Promise<AssetSummary>
  /** Saves a picked online result into the library (or finds it there already). */
  saveOnline(resultId: string, name?: string): Promise<Result<{ asset: Asset }>>
  /** Saves the kept version of a picture the picture maker just made. Absent until the maker can keep. */
  keepMade?(jobId: string, version: number, name?: string): Promise<Result<{ asset: Asset }>>
  /** The library ranked against the words of a slide and a spot (local, no Claude call). */
  suggest(input: { text: string; focus: string }, limit: number): Asset[]
  /** A lesson changed: the library's "Used in N lessons" will be rebuilt soon. */
  lessonsChanged(): void
}

export interface LessonAssetsSources {
  assets: Pick<
    AssetsService,
    'store' | 'readOriginal' | 'markUsed' | 'summary' | 'scheduleUsageRefresh'
  >
  /** The running online service (null while the assets module has not started it). */
  online: () => Pick<OnlineService, 'saveResult'> | null
  keepMade?: LessonAssetsPort['keepMade']
}

const NO_ONLINE = 'Finding pictures online is not ready yet. Try again in a moment.'

/** The port over the app's shared assets service and online service. */
export function createLessonAssetsPort({
  assets,
  online,
  keepMade
}: LessonAssetsSources): LessonAssetsPort {
  return {
    list: () => assets.store.list(),
    get: (id) => assets.store.get(id),
    readOriginal: (id) => assets.readOriginal(id),
    markUsed: (id) => assets.markUsed(id),
    summary: (asset) => assets.summary(asset),
    async saveOnline(resultId, name) {
      const service = online()
      if (!service) return fail('io', NO_ONLINE)
      const saved = await service.saveResult(resultId, name)
      return saved.ok ? { ok: true, asset: saved.asset } : saved
    },
    ...(keepMade ? { keepMade } : {}),
    suggest: (input, limit) => rankAssets(assets.store.list(), input, limit),
    lessonsChanged: () => assets.scheduleUsageRefresh()
  }
}

/** The library assets the deck still uses, by id: the export re-adds a missing "Picture credit:" line from them. */
export function creditsOf(
  deck: Deck,
  assets: Pick<LessonAssetsPort, 'get'> | undefined
): Map<string, Pick<Asset, 'credit'>> {
  const credits = new Map<string, Pick<Asset, 'credit'>>()
  for (const slide of deck.slides) {
    for (const element of slide.elements) {
      const asset =
        element.type === 'image' && element.assetId ? assets?.get(element.assetId) : undefined
      if (asset) credits.set(asset.id, { credit: asset.credit })
    }
  }
  return credits
}
