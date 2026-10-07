/**
 * "Find images online" (A9, and the Find online tab of A13): searches the free image libraries through the
 * provider layer, gives the offline renderer data-URL thumbnails and opaque result ids, and saves picked results
 * into the library with their licence and credit (agents/ASSETS.md §3.9, §7). Only the search words ever leave
 * the PC. One result she names herself goes straight in; several go through the review queue (`OnlineReviewPort`).
 */
import type { Asset } from '@shared/assets/types'
import type {
  AssetSummary,
  OnlineKindFilter,
  OnlineQuery,
  OnlineResult,
  OnlineSearchResult
} from '@shared/contracts/assets'
import { fail, ok, type Failure, type Result } from '@shared/result'
import { uniqueAssetName } from '@shared/assets/names'
import type { FetchFn, ImageSearchProvider } from '../../imageProviders/types'
import { AssetError, type NewAsset } from '../store'
import type { ImageTools } from '../thumbs'
import { cleanOnlineTitle, imageKindsOf, licenceOf, onlineProviderOf } from './mapping'
import { allFailed, mergeResults, PAGE_SIZE } from './merge'
import { prepareResult, type PrepareDeps } from './prepare'
import { ResultRegistry, type ResultRecord } from './results'
import { mapLimit, OnlineThumbnails } from './thumbnails'
import type { OnlineDescribePort, OnlineReviewPort } from './types'

export { BUSY_MESSAGE, PAGE_SIZE } from './merge'

export const MAX_PAGES = 10
export const MAX_PICKED = 24
const KINDS: readonly OnlineKindFilter[] = ['any', 'photo', 'drawing', 'diagram']
export const EXPIRED_MESSAGE = 'That search result has expired. Search again.'

/** The part of the assets service this one needs. */
export interface OnlineAssets {
  add(input: NewAsset): Promise<Asset>
  takenNames(): string[]
  findBySha(sha256: string): Asset | undefined
  summary(asset: Asset): Promise<AssetSummary>
}

export interface OnlineServiceDeps {
  providers: ImageSearchProvider[]
  fetchFn: FetchFn
  userAgent?: string
  tools: ImageTools
  assets: OnlineAssets
  /** `<dataRoot>/modules/assets/online`. */
  dir: string
  review?: OnlineReviewPort | null
  describe?: OnlineDescribePort | null
  now?: () => number
  log?: { warn(message: string): void }
}

export class OnlineService {
  private readonly registry: ResultRegistry
  private readonly thumbs: OnlineThumbnails

  constructor(private readonly deps: OnlineServiceDeps) {
    this.registry = new ResultRegistry(deps.dir, deps.now)
    this.thumbs = new OnlineThumbnails({
      fetchFn: deps.fetchFn,
      userAgent: deps.userAgent,
      tools: deps.tools
    })
  }

  private get prepareDeps(): PrepareDeps {
    const { fetchFn, userAgent, assets, describe, now } = this.deps
    return { fetchFn, userAgent, takenNames: assets.takenNames, describe, now }
  }

  /** Forgets expired result files (call at start-up). */
  prune = (): Promise<void> => this.registry.prune()

  // ---- search -----------------------------------------------------------------------------------

  async search(query: OnlineQuery, signal?: AbortSignal): Promise<Result<OnlineSearchResult>> {
    const text =
      typeof query?.query === 'string' ? query.query.replace(/\s+/g, ' ').trim().slice(0, 200) : ''
    if (!text) return fail('invalid-input', 'Type what you are looking for.')
    const filter: OnlineKindFilter = KINDS.includes(query.kind) ? query.kind : 'any'
    const page = Math.min(MAX_PAGES, Math.max(1, Math.floor(Number(query.page) || 1)))
    const freeOnly = query.freeToUse !== false
    const { providers } = this.deps
    if (providers.length === 0) return fail('network', 'No image library is switched on.')

    const perPage = Math.ceil(PAGE_SIZE / providers.length)
    const settled = await Promise.allSettled(
      providers.map((p) =>
        p.search({ query: text, page, perPage, freeOnly, kinds: imageKindsOf(filter), signal })
      )
    )
    const statuses: OnlineSearchResult['providers'] = []
    settled.forEach((outcome, at) => {
      const provider = onlineProviderOf(providers[at]!.id)
      if (provider) statuses.push({ provider, ok: outcome.status === 'fulfilled' })
    })
    const fulfilled = settled.flatMap((o) => (o.status === 'fulfilled' ? [o.value] : []))
    if (fulfilled.length === 0) return allFailed(settled)

    const items = mergeResults(
      settled.map((o, at) => ({
        provider: providers[at]!,
        items: o.status === 'fulfilled' ? o.value.items : []
      })),
      freeOnly
    )
    const thumbs = await mapLimit(items, 6, (item) =>
      this.thumbs.dataUrl(item.item.thumbnailUrl, signal)
    )
    const ids = await this.registry.put(
      items.map((i) => i.item),
      { filter, query: text }
    )
    const taken = new Set(this.deps.assets.takenNames())
    const results: OnlineResult[] = items.map(({ item, provider }, at) => {
      const proposedName = uniqueAssetName(cleanOnlineTitle(item.title), taken)
      taken.add(proposedName)
      return {
        id: ids[at]!,
        title: cleanOnlineTitle(item.title),
        provider: onlineProviderOf(item.providerId) ?? 'openverse',
        providerLabel: provider.label,
        author: item.author.trim() || null,
        licence: licenceOf(item.licence),
        pageUrl: item.sourceUrl,
        width: item.width > 0 ? item.width : null,
        height: item.height > 0 ? item.height : null,
        thumbDataUrl: thumbs[at] ?? null,
        proposedName
      }
    })
    return ok({
      results,
      total: (page - 1) * PAGE_SIZE + results.length,
      page,
      hasMore: fulfilled.some((r) => r.hasMore),
      providers: statuses
    })
  }

  // ---- saving -----------------------------------------------------------------------------------

  private async notifyUse(record: ResultRecord): Promise<void> {
    const provider = this.deps.providers.find((p) => p.id === record.item.providerId)
    await provider?.registerUse?.(record.item).catch(() => false)
  }

  /**
   * Saves ONE result into the library (a picture already there, by content, is returned instead of copied).
   * This is also what deck-builder's `placeAsset` calls for `{ kind: 'online', resultId }`.
   */
  async saveResult(
    resultId: string,
    name?: string,
    signal?: AbortSignal
  ): Promise<Result<{ asset: Asset; created: boolean }>> {
    const record = await this.registry.get(resultId)
    if (!record) return fail('not-found', EXPIRED_MESSAGE)
    const prepared = await prepareResult(this.prepareDeps, record, name, signal)
    if (!prepared.ok) return prepared
    const existing = this.deps.assets.findBySha(prepared.prepared.sha256)
    if (existing) return ok({ asset: existing, created: false })
    try {
      const asset = await this.deps.assets.add(prepared.prepared.input)
      void this.notifyUse(record)
      return ok({ asset, created: true })
    } catch (error) {
      if (error instanceof AssetError) return fail(error.code, error.message)
      this.deps.log?.warn(`Online add failed: ${String(error)}`)
      return fail('io', 'That picture could not be saved. Try again.')
    }
  }

  /** `online:add`: `direct` saves now; `review` hands the pictures to the review queue. */
  async add(
    items: ReadonlyArray<{ id: string; name?: string }>,
    mode: 'direct' | 'review',
    signal?: AbortSignal
  ): Promise<Result<{ added: AssetSummary[] } | { batchId: string }>> {
    if (items.length === 0 || items.length > MAX_PICKED) {
      return fail('invalid-input', 'Pick between 1 and 24 pictures.')
    }
    if (mode === 'review') return this.addForReview(items, signal)
    const added: AssetSummary[] = []
    let firstFailure: Failure | null = null
    for (const { id, name } of items) {
      const saved = await this.saveResult(id, name, signal)
      if (saved.ok) added.push(await this.deps.assets.summary(saved.asset))
      else firstFailure ??= saved
    }
    return added.length === 0 && firstFailure ? firstFailure : ok({ added })
  }

  private async addForReview(
    items: ReadonlyArray<{ id: string; name?: string }>,
    signal?: AbortSignal
  ): Promise<Result<{ batchId: string }>> {
    const review = this.deps.review
    if (!review) return fail('io', 'Checking several pictures at once is not ready yet.')
    const candidates: NewAsset[] = []
    const known = new Set<string>()
    let firstFailure: Failure | null = null
    for (const { id } of items) {
      const record = await this.registry.get(id)
      if (!record) {
        firstFailure ??= fail('not-found', EXPIRED_MESSAGE)
        continue
      }
      const prepared = await prepareResult(this.prepareDeps, record, undefined, signal)
      if (!prepared.ok) {
        firstFailure ??= prepared
        continue
      }
      const { input, sha256 } = prepared.prepared
      if (known.has(sha256)) continue
      known.add(sha256)
      candidates.push(input)
    }
    if (candidates.length === 0) return firstFailure ?? fail('not-found', EXPIRED_MESSAGE)
    try {
      return ok(await review.addOnlineBatch(candidates))
    } catch (error) {
      this.deps.log?.warn(`Online review batch failed: ${String(error)}`)
      return fail('io', 'Those pictures could not be set up for checking. Try again.')
    }
  }
}
