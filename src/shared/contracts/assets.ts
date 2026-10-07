/**
 * Contract of the `assets` module: the teacher's library of reusable pictures, the review step for pictures
 * found automatically, online search and the picture maker (agents/ASSETS.md §4.1, screens A1, A2, A8, A9).
 * Placing an asset on a slide belongs to `deck-builder` (`placeAsset`, see agents/ASSETS.md §4.2); the pieces
 * both modules share live in `shared/assets`.
 */
import type { AiErrorCode, Result } from '../result'
import type {
  AssetCredit,
  AssetFoundIn,
  AssetKind,
  AssetLicence,
  AssetSource,
  AssetSourceKind,
  OnlineProvider
} from '../assets/types'
import type { AssetFilterId } from '../assets/library'
import type { MakeVersions } from '../assets/pictureMaker'
import type { NameCheck } from '../assets/names'
import type { AssetSourceRef } from '../assets/place'
import { keysOf } from './names'

export const ASSETS = 'assets' as const

// ---- the library --------------------------------------------------------------------------------

/** One card in the grid, the picker and the chip popovers. */
export interface AssetSummary {
  id: string
  name: string
  title: string
  kind: AssetKind
  tags: string[]
  /** `thumb.png` (256 px long side) as a data URL; null while it is being made. */
  thumbDataUrl: string | null
  width: number
  height: number
  sourceKind: AssetSourceKind
  /** Shown as a badge when it needs a credit or a check ("CC BY"); null for her own pictures. */
  licenceBadge: string | null
  usedInCount: number
  foundInCount: number
  lastUsedAt: string | null
  createdAt: string
}

/** The detail pane (A1) and the online result pane (A9). */
export interface AssetDetail extends AssetSummary {
  description: string
  source: AssetSource
  licence: AssetLicence
  credit: AssetCredit | null
  foundIn: AssetFoundIn[]
  bytes: number
  /** A vector picture whose file has parts the app does not draw: what is left out, in words ("embedded pictures"). */
  leftOut?: string
  /** 768 px long side, for the large preview. */
  previewDataUrl: string | null
}

/** A chip in the composer or a message: the id it meant, the name it has now. */
export interface AssetChip {
  assetId: string
  /** The current name; falls back to the name the message used when the asset is gone. */
  name: string
  kind: AssetKind | null
  thumbDataUrl: string | null
  /** True when the asset was deleted: the chip is drawn greyed with "removed". */
  removed: boolean
}

/** "From" select on A1: Anywhere, a style, Uploaded by me, Picked online, Made with Claude. */
export type AssetFrom = 'anywhere' | 'uploaded' | 'online' | 'made' | `style:${string}`

export interface AssetListQuery {
  search?: string
  filter?: AssetFilterId
  from?: AssetFrom
  sort?: 'recent' | 'name' | 'most-used'
  /** Default 60. */
  limit?: number
  cursor?: string | null
}

export interface AssetPage {
  items: AssetSummary[]
  /** Matches the query. */
  total: number
  /** All assets, whatever the query: "Your assets · 12". */
  libraryCount: number
  counts: Record<AssetFilterId, number>
  froms: Array<{ key: AssetFrom; label: string; count: number }>
  cursor: string | null
  /** The "12 assets found while learning your Science KS3 style" banner; null when nothing is waiting. */
  pendingReview: { batchId: string; found: number; styleName: string | null } | null
}

/** Where an asset is used: the "14 lessons" link (A1). */
export interface AssetUsage {
  lessons: Array<{ lessonId: string; title: string; slideNumbers: number[] }>
  foundIn: AssetFoundIn[]
}

/** Fields a teacher may edit in the detail pane. The chat name has its own call because it can be refused. */
export interface AssetEdit {
  assetId: string
  title?: string
  description?: string
  kind?: AssetKind
  /** The whole tag list (lower-case, trimmed, at most 12 of 24 characters). */
  tags?: string[]
}

// ---- adding: files, review ----------------------------------------------------------------------

export type RejectedImageReason = 'type' | 'too-large' | 'corrupt' | 'empty' | 'limit'
export interface RejectedImage {
  name: string
  reason: RejectedImageReason
}

/** Started by "Upload" or a drop: files are being cut out and described into a review batch. */
export interface AddedPictures {
  batchId: string
  accepted: number
  rejected: RejectedImage[]
}

/**
 * Why a found picture is unticked (the A2 badge). The first six are the extraction service's reasons
 * (src/main/import/assets/types.ts `LeftOutReason`); `duplicate` is added by the library check (same picture already saved).
 */
export type LeftOutReason =
  | 'pupils'
  | 'blurry'
  | 'older-version'
  | 'low-resolution'
  | 'background'
  | 'unreadable'
  | 'duplicate'

/** One found picture waiting for her OK (A2). */
export interface ReviewCandidate {
  id: string
  batchId: string
  /** The proposed chat name; always valid and free (checked in main when proposed and when edited). */
  name: string
  title: string
  kind: AssetKind
  description: string
  tags: string[]
  thumbDataUrl: string | null
  width: number
  height: number
  /** "In 24 decks". */
  decks: number
  foundIn: AssetFoundIn[]
  keep: boolean
  /** What the app suggested; the checkbox can differ. */
  suggestedKeep: boolean
  leftOut: { reason: LeftOutReason; ofName?: string } | null
}

export interface ReviewFile {
  id: string
  name: string
  kind: 'pptx' | 'pdf' | 'image'
  found: number
  state: 'waiting' | 'working' | 'done' | 'failed'
  /** "Cutting out pictures · page 4 of 6". */
  progress: { done: number; total: number } | null
  error?: string
}

export type ReviewOrigin =
  { kind: 'style'; styleId: string; styleName: string } | { kind: 'upload' } | { kind: 'online' }

export interface ReviewBatch {
  id: string
  origin: ReviewOrigin
  startedAt: string
  files: ReviewFile[]
  working: boolean
}

export interface ReviewView {
  batches: ReviewBatch[]
  candidates: ReviewCandidate[]
  found: number
  keeping: number
  leftOut: number
  stillReading: number
}

export interface ReviewEdit {
  candidateId: string
  name?: string
  title?: string
  kind?: AssetKind
  description?: string
  keep?: boolean
}

// ---- find online --------------------------------------------------------------------------------

export type OnlineKindFilter = 'any' | 'photo' | 'drawing' | 'diagram'

export interface OnlineQuery {
  query: string
  kind: OnlineKindFilter
  /** "Free to use in lessons": CC0, public domain, CC BY and CC BY-SA only. On by default. */
  freeToUse: boolean
  /** 1-based; 24 results a page. */
  page: number
}

export interface OnlineResult {
  /** Opaque, valid for this session; `online:add` and `placeAsset` take it back. */
  id: string
  title: string
  provider: OnlineProvider
  providerLabel: string
  author: string | null
  licence: AssetLicence
  pageUrl: string
  width: number | null
  height: number | null
  /** Fetched by main (the renderer is offline), 320 px long side. */
  thumbDataUrl: string | null
  /** The name that will be proposed, already valid and free. */
  proposedName: string
}

export interface OnlineSearchResult {
  results: OnlineResult[]
  total: number
  page: number
  hasMore: boolean
  /** A provider that failed does not fail the search: the others are still shown. */
  providers: Array<{ provider: OnlineProvider; ok: boolean }>
}

// ---- make a new one -----------------------------------------------------------------------------

/**
 * What "Make a new one like these" can do right now:
 * `picture-maker` = a Google key is saved and the last test passed (photo-like pictures, 2 or 4 versions);
 * `vector` = no picture maker, Claude draws simple icons and diagrams as SVG;
 * `unavailable` = no Claude key either.
 */
export type MakeMode = 'picture-maker' | 'vector' | 'unavailable'

export interface MakeRequest {
  /** Assets whose look to match (may be empty for a spot: the lesson's style is used). */
  basedOn: string[]
  prompt: string
  versions: MakeVersions
  /** Defaults to the most common kind among `basedOn`, else `picture`. */
  kind?: AssetKind
}

export interface MadeVersion {
  /** 1-based, as labelled on the sheet. */
  index: number
  state: 'waiting' | 'ready' | 'failed'
  thumbDataUrl: string | null
}

export interface MakeProgress {
  jobId: string
  stage: 'describing' | 'drawing' | 'done' | 'error'
  versions: MadeVersion[]
  /** Claude's description of the look, shown under the sheet title once known. */
  styleDescription?: string
  error?: { code: AiErrorCode | 'picture-maker'; message: string; retryable: boolean }
}

// ---- the api ------------------------------------------------------------------------------------

export interface AssetsApi {
  /** The grid for A1 / A4 / A8: filtered, searched, sorted, paged. */
  list(query?: AssetListQuery): AssetPage
  /** One asset for the detail pane. */
  get(args: { assetId: string }): Result<{ asset: AssetDetail }>
  /** Chips for ids (composer, messages, picture habits); unknown ids come back `removed`. */
  chips(args: { refs: Array<{ assetId: string; name: string }> }): AssetChip[]
  /** Resolves typed `{{names}}`; names that are not assets are left out. */
  resolveNames(args: { names: string[] }): AssetChip[]
  /** Live "Name in chat" check while typing; `assetId` is the asset being renamed. */
  checkName(args: { name: string; assetId?: string }): NameCheck
  /** Renames (ids never change, so decks and old messages are untouched); `invalid-input` carries the message. */
  rename(args: { assetId: string; name: string }): Result<{ asset: AssetSummary }>
  /** Title, description, kind and tags. */
  update(args: AssetEdit): Result<{ asset: AssetSummary }>
  /** Native dialog, then the picture is replaced in the library only (lessons keep their copy). */
  replaceFile(args: { assetId: string }): Result<{ asset: AssetSummary } | { cancelled: true }>
  /** Moves to the undo window (7 days); lessons keep their own copy. */
  remove(args: { assetId: string }): Result
  /** Undo of `remove`. */
  restore(args: { assetId: string }): Result
  /** Lessons that use it and decks it was found in. */
  usage(args: { assetId: string }): Result<{ usage: AssetUsage }>
  /**
   * "Suggested for this slide": assets ranked for a slide or a spot by name, tags and description against the
   * slide's text and the spot's words. Local, no Claude call.
   */
  suggest(args: {
    lessonId: string
    slideId: string
    words?: string
    limit?: number
  }): Result<{ assets: AssetSummary[] }>

  /** Native dialog for pictures, PDFs and PowerPoints; starts a review batch. */
  'add:pick'(): Result<AddedPictures | { cancelled: true }>
  /** Dropped files. */
  'add:paths'(args: { paths: string[] }): Result<AddedPictures>

  /** Everything waiting for review, with live progress. */
  'review:get'(): ReviewView
  /** Changes one candidate; `invalid-input` when the name is not allowed or taken. */
  'review:edit'(args: ReviewEdit): Result<{ candidate: ReviewCandidate }>
  /** Saves the ticked candidates of a batch (all batches when omitted) into the library. */
  'review:accept'(args: { batchId?: string }): Result<{ added: AssetSummary[] }>
  /** Throws a batch away. */
  'review:dismiss'(args: { batchId: string }): Result
  /**
   * "Try again" on a "Couldn't read" file row: reads that file again (its pictures arrive as candidates).
   * `not-found` when the batch or file is gone or the app no longer holds the file ("Add it again").
   */
  'review:retry'(args: { batchId: string; fileId: string }): Result

  'online:search'(query: OnlineQuery): Result<OnlineSearchResult>
  /**
   * `direct` saves now (one result, named in the detail pane); `review` opens a review batch (several results).
   * Credits and licences are stored with each asset either way.
   */
  'online:add'(args: {
    items: Array<{ id: string; name?: string }>
    mode: 'direct' | 'review'
  }): Result<{ added: AssetSummary[] } | { batchId: string }>

  /** What can be made now, which model, and what one picture costs (from imageProviders; null when not known). */
  'make:mode'(): { mode: MakeMode; modelLabel: string | null; perPictureUsd: number | null }
  'make:start'(args: MakeRequest): Result<{ jobId: string }>
  /** Keeps one version as a new asset. */
  'make:keep'(args: {
    jobId: string
    version: number
    name: string
    title?: string
    kind?: AssetKind
  }): Result<{ asset: AssetSummary }>
  'make:cancel'(args: { jobId: string }): void
  /**
   * "Try again" on one version that failed: draws just that version again (progress arrives as `make:progress`).
   * Answers when it is done: ok, or the reason it failed again. `not-found` when the job is gone,
   * `invalid-input` when that version did not fail, `refused` while the job is still drawing.
   */
  'make:retry'(args: { jobId: string; version: number }): Result
}

export interface AssetsEvents {
  /** The library changed (added, renamed, edited, removed): Assets page, pickers and chips refresh. */
  changed: { libraryCount: number }
  /** Review batches progressed or changed (files being cut out, candidates added). */
  'review:changed': ReviewView
  'make:progress': MakeProgress
}

export const ASSETS_METHODS = keysOf<AssetsApi>()([
  'list',
  'get',
  'chips',
  'resolveNames',
  'checkName',
  'rename',
  'update',
  'replaceFile',
  'remove',
  'restore',
  'usage',
  'suggest',
  'add:pick',
  'add:paths',
  'review:get',
  'review:edit',
  'review:accept',
  'review:dismiss',
  'review:retry',
  'online:search',
  'online:add',
  'make:mode',
  'make:start',
  'make:keep',
  'make:cancel',
  'make:retry'
])

export const ASSETS_EVENTS = keysOf<AssetsEvents>()(['changed', 'review:changed', 'make:progress'])

/** Re-exported so deck-builder's `placeAsset` and the editor import one name. */
export type { AssetSourceRef }
