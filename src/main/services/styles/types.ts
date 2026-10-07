/** Types shared inside the styles service (storage layout in store.ts, job in learnJob.ts). */
import type { AiService, FileAnalysis } from '@shared/ai/types'
import type {
  StyleFileErrorCode,
  StyleLibraryEvents,
  StyleProfileView
} from '@shared/contracts/style-library'
import type { Slide } from '@shared/deck/types'
import type { AiErrorCode } from '@shared/result'
import type { SourceRef, StyleProfile } from '@shared/style/types'
import type { InstalledFonts } from './fonts'
import type { PicturePorts } from './habits'
import type { ExtractFn } from './pictures'

/** Emits the module's events (`progress`, `changed`); wired to `ctx.emit` by the module. */
export type EmitStyleEvent = <K extends keyof StyleLibraryEvents>(
  name: K,
  payload: StyleLibraryEvents[K]
) => void

export interface StylesServiceDeps {
  /** Folder that holds one sub-folder per style (`<dir>/<styleId>/profile.json`, `sources/`, `history/`). */
  dir: string
  ai: AiService
  emit?: EmitStyleEvent
  clock?: () => Date
  /** Id factory, e.g. `(prefix) => newId(prefix)`; injectable for deterministic tests. */
  ids?: (prefix: string) => string
  /** Wait before re-synthesising after a learned file was removed (spec: 10 s). */
  resynthesiseDelayMs?: number
  /** Files read at once (spec: 2). */
  concurrency?: number
  /** The local picture extractor (default: `extractAssets`). A test seam. */
  extract?: ExtractFn
  /** The review queue and the library, or none while the assets module is not running (default: the app's shared ones). */
  ports?: () => Promise<PicturePorts> | PicturePorts
  /** The fonts installed on this PC (default: the Windows registry, as the export warning reads it). */
  installedFonts?: InstalledFonts
  /** Test seams for the import limits (spec: 50 files, 50 MB each). */
  limits?: { maxFiles?: number; maxFileBytes?: number }
}

export interface FileError {
  code: StyleFileErrorCode
  message: string
  retryable: boolean
}

/** Per-file facts that do not belong in the StyleProfile. */
export interface FileMeta {
  fileName: string
  kind: SourceRef['kind']
  addedAt: string
  hash: string
  mayContainNames: boolean
  error?: FileError
  /** Pages that are the published scheme's own plan (a "source plan"), not her slides (sourcePlan.ts). */
  sourcePlanPages?: number[]
}

/** The picture step's bookkeeping, kept in meta.json (the facts themselves are in `sources/<id>.pictures.json`). */
export interface PicturesMeta {
  /** The review batch "Review assets" opens (null: none was made, or the queue was not running). */
  batchId: string | null
  /** Every distinct reusable picture found so far, by its group id: the library hash and whether it was suggested. */
  keys: Record<string, { sha: string; keep: boolean }>
  /** The kept assets the habits were last built from ("assetKey:assetId", sorted), to notice when she saves more. */
  kept: string[]
}

/** `style meta` stored next to profile.json (meta.json). */
export interface StyleMeta {
  nameSource: 'auto' | 'user'
  /** Set by `save`: before that the style is a draft. */
  saved: boolean
  /** True when the current learned files have been through Claude's synthesis. */
  synthesised: boolean
  /** True once Claude has built a full profile (before that the profile is a local vote). */
  hasSynthesis: boolean
  testSlide: Slide | null
  pausedFor?: AiErrorCode
  files: Record<string, FileMeta>
  /** What the picture step found for this style (pictures.ts); absent until it has run once. */
  pictures?: PicturesMeta
  /** Removed files kept briefly so Undo needs no new Claude call. */
  removed: Record<string, { source: SourceRef; file: FileMeta; at: string }>
}

/** A style held in memory (the service writes it through to disk on every change). */
export interface StyleState {
  profile: StyleProfile
  meta: StyleMeta
  /** Per-file analyses of the learned files, by source id. */
  analyses: Map<string, FileAnalysis>
  /** Runtime only: what the A6 cards show (names and thumbnails are looked up asynchronously, views are sync). */
  pictureView?: PictureView
}

export type LearnOutcome = 'completed' | 'cancelled' | 'paused' | 'nothing-to-do'

/** A running learning job: await `done`, or call `cancel()` (learned files are kept). */
export interface LearnHandle {
  styleId: string
  done: Promise<LearnOutcome>
  cancel(): void
}

/** The A6 data the views read without waiting (refreshed by `refreshPictureView`). */
export interface PictureView {
  lines: StyleProfileView['pictureHabits']
  found: StyleProfileView['assetsFound']
}
