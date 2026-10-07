/**
 * The assets service: ONE instance per app (`getSharedAssets()`), used by the `assets` module main and, later, by
 * the deck-builder (`placeAsset` reads files, marks use and saves online and made pictures). It owns the store
 * and the thumbnails and answers the library half of the contract (agents/ASSETS.md §4.1). Failures are returned
 * as `Result` (an `AssetError` becomes its code and message); nothing here imports Electron.
 */
import { checkAssetName } from '@shared/assets/names'
import { ASSET_KINDS, type Asset } from '@shared/assets/types'
import type {
  AssetChip,
  AssetDetail,
  AssetEdit,
  AssetListQuery,
  AssetPage,
  AssetSummary,
  AssetUsage
} from '@shared/contracts/assets'
import type { NameCheck } from '@shared/assets/names'
import { fail, ok, type Failure, type Result } from '@shared/result'
import { moduleDataDir } from '../paths'
import { chipOf, detailOf, queryLibrary, removedChip, summaryOf } from './library'
import { AssetError, AssetStore, sniffAssetExt, type LoadReport, type NewAsset } from './store'
import { rankAssets } from './suggest'
import { createElectronImageTools, ThumbnailService, type ImageTools } from './thumbs'
import { createLessonsPortFromDisk, usageOf, usedInMap, type LessonsPort } from './usage'

export interface AssetsServiceDeps {
  /** `<dataRoot>/modules/assets`. */
  dir: string
  tools?: ImageTools
  lessons?: LessonsPort | null
  now?: () => Date
  log?: { warn(message: string): void }
}

const EMPTY_NAMES: ReadonlyMap<string, string> = new Map()
const THUMB_BATCH = 8
const USAGE_DEBOUNCE_MS = 750

/** An `AssetError` as a `Failure`; anything else is an `io` failure with a plain message. */
export function failureOf(error: unknown, warn?: (message: string) => void): Failure {
  if (error instanceof AssetError) return fail(error.code, error.message)
  warn?.(`Assets: ${String(error)}`)
  return fail('io', 'Something went wrong with your assets. Try again.')
}

export class AssetsService {
  readonly store: AssetStore
  readonly thumbs: ThumbnailService
  /** Looking at pictures (size, fingerprint, scaling): shared with the online service. */
  readonly tools: ImageTools
  private lessons: LessonsPort | null
  private listeners = new Set<(libraryCount: number) => void>()
  private styleNames: () => Promise<ReadonlyMap<string, string>> | ReadonlyMap<string, string> =
    () => EMPTY_NAMES
  private pendingReview: () => Promise<AssetPage['pendingReview']> | AssetPage['pendingReview'] =
    () => null
  private usageReady: Promise<void> = Promise.resolve()
  private usageTimer: ReturnType<typeof setTimeout> | undefined
  private report: LoadReport | null = null

  constructor(private readonly deps: AssetsServiceDeps) {
    const tools = (this.tools = deps.tools ?? createElectronImageTools())
    this.lessons = deps.lessons ?? null
    this.store = new AssetStore({ dir: deps.dir, tools, now: deps.now, log: deps.log })
    this.thumbs = new ThumbnailService({
      tools,
      thumbPath: this.store.thumbPath,
      readOriginal: (asset) => this.store.readOriginal(asset),
      warn: deps.log?.warn
    })
  }

  // ---- wiring -----------------------------------------------------------------------------------

  /** The deck-builder registers how lessons are scanned (and, if it likes, which slide a suggestion is for). */
  setLessonsPort(port: LessonsPort | null): void {
    this.lessons = port
    this.scheduleUsageRefresh()
  }
  setStyleNames(
    read: () => Promise<ReadonlyMap<string, string>> | ReadonlyMap<string, string>
  ): void {
    this.styleNames = read
  }
  /** The banner of A1: set by the review queue (WP2). */
  setPendingReview(
    read: () => Promise<AssetPage['pendingReview']> | AssetPage['pendingReview']
  ): void {
    this.pendingReview = read
  }
  onChanged(listener: (libraryCount: number) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  private changed(): void {
    for (const listener of this.listeners) listener(this.store.size)
  }

  /** Loads the library (rebuilding it when needed) and starts the first usage scan. Never throws. */
  async init(): Promise<LoadReport> {
    try {
      this.report = await this.store.load()
    } catch (error) {
      this.deps.log?.warn(`The library could not be loaded: ${String(error)}`)
      this.report = { recovered: 0, setAside: 0, renamed: 0 }
    }
    this.usageReady = this.refreshUsage().then(() => undefined)
    return this.report
  }
  /** What loading had to repair, once: for the "Your library was tidied up" toast. Null when nothing. */
  takeLoadReport(): LoadReport | null {
    const report = this.report
    this.report = null
    return report && (report.recovered > 0 || report.setAside > 0) ? report : null
  }

  // ---- usage ------------------------------------------------------------------------------------

  /** Re-reads the lessons and refreshes `usedIn`. Resolves to true when anything changed. */
  async refreshUsage(): Promise<boolean> {
    if (!this.lessons) return false
    try {
      const changed = this.store.setUsage(usedInMap(await this.lessons.lessonsUsingAssets()))
      if (changed) this.changed()
      return changed
    } catch (error) {
      this.deps.log?.warn(`Assets usage scan failed: ${String(error)}`)
      return false
    }
  }
  /** Debounced `refreshUsage`: call after a lesson changes. */
  scheduleUsageRefresh(): void {
    clearTimeout(this.usageTimer)
    this.usageTimer = setTimeout(() => {
      this.usageReady = this.refreshUsage().then(() => undefined)
    }, USAGE_DEBOUNCE_MS)
  }
  dispose(): void {
    clearTimeout(this.usageTimer)
    this.listeners.clear()
  }

  // ---- reading ----------------------------------------------------------------------------------

  get libraryCount(): number {
    return this.store.size
  }
  getAsset = (assetId: string): Asset | undefined => this.store.get(assetId)
  findBySha = (sha: string): Asset | undefined => this.store.bySha(sha)
  takenNames = (): string[] => this.store.names()
  readOriginal = (assetId: string): Promise<Uint8Array | undefined> => {
    const asset = this.store.get(assetId)
    return asset ? this.store.readOriginal(asset) : Promise.resolve(undefined)
  }

  async summary(asset: Asset): Promise<AssetSummary> {
    return summaryOf(asset, await this.thumbs.thumbDataUrl(asset))
  }

  private async summaries(assets: readonly Asset[]): Promise<AssetSummary[]> {
    const out: AssetSummary[] = []
    for (let i = 0; i < assets.length; i += THUMB_BATCH) {
      out.push(...(await Promise.all(assets.slice(i, i + THUMB_BATCH).map((a) => this.summary(a)))))
    }
    return out
  }

  async list(query?: AssetListQuery): Promise<AssetPage> {
    await this.usageReady
    const names = await this.styleNames()
    const result = queryLibrary(this.store.list(), query, names)
    return {
      items: await this.summaries(result.page),
      total: result.total,
      libraryCount: this.store.size,
      counts: result.counts,
      froms: result.froms,
      cursor: result.cursor,
      pendingReview: await this.pendingReview()
    }
  }

  async get(assetId: string): Promise<Result<{ asset: AssetDetail }>> {
    await this.usageReady
    const asset = this.store.get(assetId)
    if (!asset) return fail('not-found', 'That picture is not in your library.')
    const [thumb, preview] = await Promise.all([
      this.thumbs.thumbDataUrl(asset),
      this.thumbs.previewDataUrl(asset)
    ])
    return ok({ asset: detailOf(asset, thumb, preview) })
  }

  async chips(refs: ReadonlyArray<{ assetId: string; name: string }>): Promise<AssetChip[]> {
    return Promise.all(
      refs.map(async ({ assetId, name }) => {
        const asset = this.store.get(assetId)
        return asset
          ? chipOf(asset, await this.thumbs.thumbDataUrl(asset))
          : removedChip(assetId, name)
      })
    )
  }

  async resolveNames(names: readonly string[]): Promise<AssetChip[]> {
    const found: Asset[] = []
    for (const name of names) {
      const asset = this.store.byName(name.replace(/^\{\{|\}\}$/g, '').trim())
      if (asset && !found.includes(asset)) found.push(asset)
    }
    return Promise.all(found.map(async (a) => chipOf(a, await this.thumbs.thumbDataUrl(a))))
  }

  checkName(name: string, assetId?: string): NameCheck {
    const own = assetId ? this.store.get(assetId)?.name : undefined
    return checkAssetName(name, this.store.names(), own)
  }

  async usage(assetId: string): Promise<Result<{ usage: AssetUsage }>> {
    const asset = this.store.get(assetId)
    if (!asset) return fail('not-found', 'That picture is not in your library.')
    try {
      const lessons = this.lessons ? await this.lessons.lessonsUsingAssets() : []
      return ok({ usage: { lessons: usageOf(assetId, lessons), foundIn: asset.foundIn } })
    } catch (error) {
      return failureOf(error, this.deps.log?.warn)
    }
  }

  async suggest(args: {
    lessonId: string
    slideId: string
    words?: string
    limit?: number
  }): Promise<Result<{ assets: AssetSummary[] }>> {
    let text = ''
    let spotWords = ''
    if (this.lessons) {
      const context = await this.lessons
        .slideContext(args.lessonId, args.slideId)
        .catch(() => undefined)
      if (!context) return fail('not-found', 'That slide is not available.')
      text = context.text
      spotWords = context.spotWords
    }
    const limit = Math.min(24, Math.max(1, Math.floor(args.limit ?? 6)))
    const ranked = rankAssets(
      this.store.list(),
      { text, focus: `${args.words ?? ''} ${spotWords}` },
      limit
    )
    return ok({ assets: await this.summaries(ranked) })
  }

  // ---- changing ---------------------------------------------------------------------------------

  private async run<T extends object>(task: () => Promise<T>): Promise<Result<T>> {
    try {
      const value = await task()
      this.changed()
      return ok(value)
    } catch (error) {
      return failureOf(error, this.deps.log?.warn)
    }
  }

  rename(assetId: string, name: string): Promise<Result<{ asset: AssetSummary }>> {
    return this.run(async () => ({
      asset: await this.summary(await this.store.patch(assetId, { name }))
    }))
  }

  update(edit: AssetEdit): Promise<Result<{ asset: AssetSummary }>> {
    const { assetId, title, description, kind, tags } = edit
    if (kind !== undefined && !ASSET_KINDS.includes(kind)) {
      return Promise.resolve(fail('invalid-input', 'That kind of picture is not known.'))
    }
    return this.run(async () => ({
      asset: await this.summary(await this.store.patch(assetId, { title, description, kind, tags }))
    }))
  }

  /** Saves a new picture and its thumbnail. Throws `AssetError` (callers wrap it with `failureOf`). */
  async add(input: NewAsset): Promise<Asset> {
    const asset = await this.store.create(input)
    await this.thumbs.make(asset)
    this.changed()
    return asset
  }

  /** The new file goes into the library only: lessons keep the copy they made. */
  replaceFile(assetId: string, bytes: Uint8Array): Promise<Result<{ asset: AssetSummary }>> {
    return this.run(async () => {
      const ext = sniffAssetExt(bytes)
      if (!ext) throw new AssetError('invalid-input', 'That file is not a picture the app can use.')
      const next = await this.store.replaceFile(assetId, bytes, ext)
      await this.thumbs.forget(assetId)
      await this.thumbs.make(next)
      return { asset: await this.summary(next) }
    })
  }

  remove(assetId: string): Promise<Result> {
    return this.run(async () => {
      await this.store.remove(assetId)
      await this.thumbs.forget(assetId)
      return {}
    })
  }

  restore(assetId: string): Promise<Result> {
    return this.run(async () => {
      await this.store.restore(assetId)
      return {}
    })
  }

  /** `placeAsset` calls this: only `lastUsedAt` moves. Never throws. */
  async markUsed(assetId: string, at: Date = new Date()): Promise<void> {
    try {
      await this.store.patch(assetId, { lastUsedAt: at.toISOString() })
      this.changed()
    } catch (error) {
      this.deps.log?.warn(`Could not mark ${assetId} as used: ${String(error)}`)
    }
  }
}

// ---- the shared instance -----------------------------------------------------------------------

let shared: AssetsService | null = null

/** The app's ONE assets service (built on first use from the data folder). */
export function getSharedAssets(): AssetsService {
  shared ??= new AssetsService({
    dir: moduleDataDir('assets'),
    lessons: createLessonsPortFromDisk(moduleDataDir('deck-builder'))
  })
  return shared
}

/** Replace (or clear) the shared instance: for tests and seeds. */
export function setSharedAssets(next: AssetsService | null): void {
  shared = next
}

export function disposeSharedAssets(): void {
  shared?.dispose()
  shared = null
}
