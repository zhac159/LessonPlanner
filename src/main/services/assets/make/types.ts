/**
 * Types of the make-new service (agents/ASSETS.md §3.8, §3.13, §5.6): the ports it needs (so tests need no
 * Electron, network or disk), the job it keeps in memory and the part of the contract it serves.
 */
import type { Asset, AssetKind } from '@shared/assets/types'
import type { ContractImpl } from '@shared/contract'
import type { Failure } from '@shared/result'
import type { AssetsApi, AssetSummary, MakeProgress, MakeRequest } from '@shared/contracts/assets'
import type { AiService } from '@shared/ai/types'
import type { NameCheck } from '@shared/assets/names'
import type { PictureFacts } from '../../../ai/schemas/pictures'
import type { PictureMaker } from '../../imageProviders/nanoBanana'
import type { FetchFn } from '../../imageProviders/types'
import type { ImageTools } from '../imageTools'
import type { NewAsset } from '../storeParts'

/** The four `make:*` methods of `AssetsApi`: what `createMakeApi` returns. */
export type MakeApiPart = Pick<
  AssetsApi,
  'make:mode' | 'make:start' | 'make:keep' | 'make:cancel' | 'make:retry'
>
export type MakeApiImpl = ContractImpl<MakeApiPart>

/** The part of `AssetsService` the make service uses (the real service fits; tests pass a small fake). */
export interface MakeAssetsPort {
  readonly tools: ImageTools
  /** The library store: `get` returns the asset, or undefined when it was removed. */
  readonly store: { get(assetId: string): Asset | undefined }
  readOriginal(assetId: string): Promise<Uint8Array | undefined>
  add(input: NewAsset): Promise<Asset>
  summary(asset: Asset): Promise<AssetSummary>
  checkName(name: string): NameCheck
}

/** Where the Google key and the chosen model live (Settings, A7). The key never leaves main. */
export interface PictureMakerSettings {
  hasKey(): Promise<boolean>
  getKey(): Promise<string | undefined>
  model(): Promise<string>
  /** The last A7 key check: `connected`, an error code, or null when never tested. */
  lastTest(): Promise<string | null>
}

export interface MakeServiceDeps {
  assets: MakeAssetsPort
  /** Only the two picture calls are used. */
  ai: Pick<AiService, 'describeStyleOfAssets' | 'drawSvg'>
  /** Pushes `make:progress` to the renderer. */
  emit(progress: MakeProgress): void
  /** `<dataRoot>/modules/settings`: the Google key (`secrets/google.key`) and `picture-maker.json`. */
  settingsDir: string
  /** SLIDE_PLANNER_FAKE_AI=1: a fake maker (tiny PNGs) instead of Google. */
  fake?: boolean
  log?: { warn(message: string): void }
  /** Remembers the request and style as the new asset's description, so no Claude call is needed later. */
  describeCache?: { set(sha256: string, facts: PictureFacts): void | Promise<void> }
  /** Called once per picture that arrived (for the usage log); never throws into the job. */
  recordCost?(entry: { model: string; usd: number | null; count: number }): void
  // ---- overrides for tests
  settings?: PictureMakerSettings
  hasClaudeKey?: () => Promise<boolean>
  createMaker?: (options: {
    getKey: () => Promise<string | undefined>
    model: string
    fetchFn: FetchFn
  }) => PictureMaker
  fetchFn?: FetchFn
  now?: () => Date
  newId?: () => string
}

export interface MakeJobVersion {
  state: 'waiting' | 'ready' | 'failed'
  bytes?: Uint8Array
  ext?: '.png' | '.jpg' | '.webp' | '.svg'
  thumbDataUrl: string | null
}

export interface MakeJob {
  id: string
  request: string
  /** The kind the pictures are saved as. */
  kind: AssetKind
  basedOn: string[]
  /** `gemini-3-pro-image`, `gemini-nano-banana-2.1` or `claude-svg`. */
  model: string
  controller: AbortController
  versions: MakeJobVersion[]
  styleDescription: string
  basedOnNames: string[]
  finished: boolean
  /** What drawing ONE version again needs (set once the job reached "drawing"): "Try again" on a failed tile. */
  redraw?: (index: number) => Promise<Failure | undefined>
}

export type { MakeRequest }
