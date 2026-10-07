/**
 * Contract of the `style-library` module: styles (StyleProfiles), drafts and the learning queue
 * (design/screens/03-home.md §6, 04-create-style.md §6). Learning runs as a main-owned job and
 * reports through `progress`; there is no jobId because the queue belongs to the style.
 */
import type { Slide } from '../deck/types'
import type { AssetChip } from './assets'
import type { AiErrorCode, Result } from '../result'
import type { StyleProfile } from '../style/types'
import { keysOf } from './names'

export const STYLE_LIBRARY = 'style-library' as const

/** One style card on Home and one row in the editor's style chip menu (03 §6). */
export interface StyleSummary {
  id: string
  name: string
  isDefault: boolean
  status: StyleProfile['status']
  /** At most 4 hex colours: accent, text, highlight, chipBg. */
  swatches: string[]
  titleFont: string
  /** Learned sources. */
  deckCount: number
  learning: { learned: number; total: number } | null
  primaryHex: string
  tintHex: string
  updatedAt: string
}

/** Why a dropped or picked file was not added (03 §6). */
export interface RejectedFile {
  name: string
  reason: 'type' | 'old-ppt' | 'too-large' | 'duplicate' | 'limit'
}

export type StyleFileErrorCode =
  'password' | 'scanned' | 'corrupt' | 'empty' | 'too-large' | AiErrorCode

/** A source file in the learning queue; a projection of SourceRef (04 §6). */
export interface StyleFile {
  id: string
  name: string
  kind: 'pdf' | 'pptx'
  /** Pages (pdf) or slides (pptx); null until read. */
  units: number | null
  status: 'waiting' | 'reading' | 'learned' | 'failed'
  error?: { code: StyleFileErrorCode; message: string; retryable: boolean }
  mayContainNames: boolean
}

export interface LearnProgress {
  learned: number
  failed: number
  total: number
  /** `pictures` = looking at the pictures (cutting out, grouping, habits): "Looking at your pictures". */
  stage: 'idle' | 'reading' | 'pictures' | 'synthesising' | 'done' | 'paused'
  /** An account error that pauses the whole queue (no-key, invalid-key, no-credit). */
  pausedFor?: AiErrorCode
  etaSeconds: number | null
}

/** Display projection of a StyleProfile: no exemplars, no sources (04 §6). */
export interface StyleProfileView {
  colours: Array<{ token: string; hex: string; label: string; usage: string }>
  fonts: Array<{
    use: 'title' | 'body' | 'accent'
    family: string
    weight: number
    sizeRangePt: [number, number] | null
    available: boolean
    fallbackStack: string
  }>
  habits: string[]
  slideTypes: string[]
  voiceRules: string[]
  /** What SlideView needs to draw a slide in this style. */
  tokens: StyleProfile['tokens']
  components: StyleProfile['components']
  /** From synthesis; null means the provisional template is drawn instead (04 §8). */
  testSlide: Slide | null
  version: number
  /**
   * "Picture habits" lines (agents/ASSETS.md §3.6): her general habits first, then one line per placement rule written with the
   * asset's CURRENT name as `{{name}}` (drawn as a chip). Empty until the pictures have been looked at.
   */
  pictureHabits?: string[]
  /** "Assets I found"; null until the pictures have been looked at (skeleton), `found: 0` when there are none. */
  assetsFound?: {
    found: number
    suggested: number
    /** Assets from this style's files that are saved in Your assets. */
    saved: number
    /** The review batch "Review assets" opens; null when there is nothing waiting. */
    batchId: string | null
    /** At most six, for the tile row. */
    preview: AssetChip[]
  } | null
}

/** The whole Create a style screen state for one style (04 §6). */
export interface StyleDraftView {
  id: string
  name: string
  nameSource: 'auto' | 'user'
  isDefault: boolean
  status: StyleProfile['status']
  files: StyleFile[]
  progress: LearnProgress
  /** Null until the first file is learned. */
  profile: StyleProfileView | null
  corrections: Array<{ text: string; at: string }>
}

/** A batch of files was handled; `rejected` explains the ones that were not added. */
export interface AddedFiles {
  added: number
  rejected: RejectedFile[]
}

export interface StyleLibraryApi {
  /** All styles, for Home cards and the style chip (03 §6). */
  list(): StyleSummary[]
  /** Creates a draft style from dropped files (03 §6). */
  createDraft(args: { paths: string[] }): Result<AddedFiles & { styleId: string }>
  /** Native file dialog, then a draft; `{ cancelled: true }` when dismissed (03 §6). */
  pickAndCreateDraft(): Result<(AddedFiles & { styleId: string }) | { cancelled: true }>
  /** One style with its queue and learned profile (04 §6). */
  get(args: { styleId: string }): Result<{ style: StyleDraftView }>
  /** Native file dialog for more files (04 §6). */
  pickFiles(args: { styleId: string }): Result<AddedFiles | { cancelled: true }>
  /** Adds dropped files to the queue (04 §6). */
  addFiles(args: { styleId: string; paths: string[] }): Result<AddedFiles>
  /** Removes a file from the queue; undoable with `restoreFile` (04 §6). */
  removeFile(args: { styleId: string; fileId: string }): Result
  /** Undo of `removeFile`; reuses the cached analysis (04 §6). */
  restoreFile(args: { styleId: string; fileId: string }): Result
  /** Retries one failed file (04 §6). */
  retryFile(args: { styleId: string; fileId: string }): Result
  /** "Carry on" after an account error paused the queue (04 §6). */
  resume(args: { styleId: string }): Result
  /** Renames or marks default; a local edit with no Claude call (04 §6). */
  update(args: {
    styleId: string
    name?: string
    isDefault?: boolean
  }): Result<{ style: StyleDraftView }>
  /** Applies a plain-English correction via Claude (04 §6, ai-pipeline.md §4.3). */
  correct(args: { styleId: string; text: string }): Result<{ message: string; version: number }>
  /** Saves the draft as ready (or learning while files are still being read) (04 §6). */
  save(args: { styleId: string }): Result<{ style: StyleSummary }>
}

export interface StyleLibraryEvents {
  /** Live learning updates for the Create a style panel (04 §6, ai-pipeline.md §7). */
  progress: {
    styleId: string
    file?: StyleFile
    progress: LearnProgress
    partialProfile?: StyleProfileView
    name?: string
  }
  /** The list changed; Home and the editor style chip listen (03 §6). */
  changed: StyleSummary[]
}

export const STYLE_LIBRARY_METHODS = keysOf<StyleLibraryApi>()([
  'list',
  'createDraft',
  'pickAndCreateDraft',
  'get',
  'pickFiles',
  'addFiles',
  'removeFile',
  'restoreFile',
  'retryFile',
  'resume',
  'update',
  'correct',
  'save'
])

export const STYLE_LIBRARY_EVENTS = keysOf<StyleLibraryEvents>()(['progress', 'changed'])
