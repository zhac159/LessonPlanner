/**
 * Contract of the `deck-builder` module: lessons, generation, direct edits, export and present,
 * plus the `chat:` and `plugins:` areas that live inside it (design/screens/03-home.md §6,
 * 05-new-lesson.md §6, 06-editor.md §6). `annotate` has no channels: circle-to-edit is local to the
 * renderer and reaches main as `RegionDraft`s in `chat:send` and `plugins:run`.
 */
import type { AssetSummary } from './assets'
import type { PlaceAssetArgs } from '../assets/place'
import type { ChangeSet, Deck, DeckOp, LessonMeta, Slide } from '../deck/types'
import type { Result } from '../result'
import { CHAT_EVENTS, CHAT_METHODS } from './deck-builder-chat'
import type { ChatApi, ChatEvents, ChatItem, DocumentKind, StartedJob } from './deck-builder-chat'
import { PLUGINS_EVENTS, PLUGINS_METHODS } from './deck-builder-plugins'
import type { PluginsApi, PluginsEvents } from './deck-builder-plugins'
import { keysOf } from './names'
import type { StyleProfileView } from './style-library'

export const DECK_BUILDER = 'deck-builder' as const

/** One lesson card on Home and one row in the past-lessons dialog (03 §6). */
export interface LessonSummary {
  id: string
  title: string
  /** "Year 8", "Form time": used for filter and sort. */
  yearGroup: string | null
  /** "Year 8", "Form": the card tag. */
  yearShort: string | null
  slideCount: number
  updatedAt: string
  styleId: string | null
  /** lessons/<id>/thumb.png (480×270) as a data URL. */
  thumbDataUrl: string | null
  status: 'ready' | 'generating'
  /** True when deck.json cannot be read: Home shows a recoverable error card instead of crashing. */
  damaged?: boolean
}

/** A learning-objectives document the teacher attached (03 §6). */
export interface LoDocument {
  id: string
  name: string
  kind: DocumentKind
  sizeBytes: number
}

/** What the teacher set up on Home or New lesson (05 §6). */
export interface CreateLessonRequest {
  /** The Composer text. */
  objectivesText: string
  /** Attached LO documents (max 3). */
  documentIds: string[]
  /** Null means the built-in plain style. */
  styleId: string | null
  /** Only when the teacher typed one. */
  title: string | null
  meta: Partial<LessonMeta>
  /** True for "Make my slides". */
  startGeneration: boolean
  /** True for "Blank slide". */
  blankSlide?: boolean
}

export type JobKind = 'generation' | 'chat' | 'plugin'

/** What the editor needs to enable Undo and Redo and label them (06 §6). */
export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  undoChangeSetId: string | null
  redoChangeSetId: string | null
  undoSummary?: string
  redoSummary?: string
}

/** A private note on a slide: stored with the lesson, never exported or sent to Claude (06 §8.3). */
export interface StickyNote {
  id: string
  slideId: string
  /** Slide units (1920×1080). */
  x: number
  y: number
  text: string
}

/** Everything the editor needs to open a lesson (06 §6). */
export interface LessonView {
  deck: Deck
  titleSource: 'auto' | 'user'
  /** From style-library; what SlideView needs to draw slides. */
  style: StyleProfileView | null
  history: HistoryState
  chat: ChatItem[]
  runningJob: { jobId: string; kind: JobKind; messageId: string } | null
  stickyNotes: StickyNote[]
}

/** Outcome of an export; failures are a status, not a thrown error (06 §6, deck-model.md §5). */
export type ExportResult =
  | { status: 'saved'; path: string; fileName: string; missingFonts: string[] }
  | { status: 'cancelled' }
  /** Picture spots are still empty and nothing was saved: ask first (pass `ignoreSpots` to export anyway). */
  | { status: 'spots'; count: number; slides: number[] }
  | { status: 'error'; code: 'file-locked' | 'io'; message: string }

/** What `placeAsset` did: the change, where the picture went and the chat message that says so (already stored). */
export interface PlaceAssetResult {
  changeSet: ChangeSet
  history: HistoryState
  elementId: string
  placed: {
    x: number
    y: number
    w: number
    h: number
    fit: 'cover' | 'contain'
    lowResolution: boolean
  }
  /** The library asset used or created (saved first when it came from online or was just made). */
  asset: AssetSummary
  /** "Added {{name}} to slide 3." with its ResultChip. */
  chat: ChatItem
}

/** What Claude found in a freshly attached LO document (05 §6, ai-pipeline.md §4.4). */
export interface DocumentReadResult {
  objectives: string[]
  title?: string
  yearGroup?: string
  durationMin?: number
}

export interface LessonsApi {
  /** All lessons for Home and the past-lessons dialog (03 §6). */
  listLessons(): LessonSummary[]
  /** Native file dialog for one LO document (.docx .pdf .pptx) (03 §6). */
  pickLoDocument(): Result<{ document: LoDocument } | { cancelled: true }>
  /** Imports a dropped LO document (03 §6). */
  importLoDocument(args: { path: string }): Result<{ document: LoDocument }>
  /** Creates a lesson, optionally starting generation as a job (05 §6). */
  createLesson(
    req: CreateLessonRequest
  ): Result<{ lessonId: string; jobId: string | null; messageId: string | null }>
  /** Generates into an existing lesson, e.g. after undoing a generation (05 §6). */
  generate(args: {
    lessonId: string
    text: string
    documentIds: string[]
    meta: Partial<LessonMeta>
  }): Result<StartedJob>
  /** "Finish the rest" after a partial generation (05 §6). */
  finishGeneration(args: { lessonId: string }): Result<StartedJob>
  /** Cancels a running generation job (05 §6). */
  cancel(args: { jobId: string }): void
  /** Copies a lesson (03 §6). */
  duplicateLesson(args: { lessonId: string }): Result<{ lesson: LessonSummary }>
  /** Renames a lesson as a setMeta ChangeSet, one undo step (03 §6, 06 §6). */
  renameLesson(args: { lessonId: string; title: string }): Result<{ lesson: LessonSummary }>
  /** Moves a lesson to the Recycle Bin (03 §6). */
  deleteLesson(args: { lessonId: string }): Result
  /** Undo for the "Lesson deleted · Undo" toast, inside the undo window (03 §6). */
  restoreLesson(args: { lessonId: string }): Result
}

export interface EditorApi {
  /** Loads everything the editor shows for one lesson (06 §6). */
  openLesson(args: { lessonId: string }): Result<LessonView>
  /** Applies the teacher's direct edit as one ChangeSet (06 §6). */
  applyOps(args: {
    lessonId: string
    ops: DeckOp[]
    summary: string
  }): Result<{ changeSet: ChangeSet; history: HistoryState }>
  /** Undoes the last ChangeSet, also across restarts (06 §6). */
  undo(args: { lessonId: string }): Result<{ deck: Deck; history: HistoryState }>
  /** Redoes the last undone ChangeSet (06 §6). */
  redo(args: { lessonId: string }): Result<{ deck: Deck; history: HistoryState }>
  /** Replaces the lesson's sticky notes (06 §6). */
  setStickyNotes(args: { lessonId: string; notes: StickyNote[] }): Result
  /** Places an asset (library, online or just made) as ONE ChangeSet; copies it into the lesson on first use (agents/ASSETS.md §2.4, §4.2). */
  placeAsset(args: PlaceAssetArgs): Result<PlaceAssetResult>
  /** Shows the Save dialog and writes the .pptx (06 §6, deck-model.md §5); `spots` first while picture spots are empty. */
  exportPptx(args: { lessonId: string; ignoreSpots?: boolean }): ExportResult
  /** Opens an exported file; only paths main exported this session (06 §6). */
  openExport(args: { path: string }): Result
  /** Reveals an exported file in the folder (06 §6). */
  showExport(args: { path: string }): Result
  /** Full-screen on or off for Present (06 §6). */
  present(args: { on: boolean }): void
}

export type DeckBuilderApi = LessonsApi & EditorApi & ChatApi & PluginsApi

/** Progress of a generation job; `title` arrives once the plan exists (05 §6, ai-pipeline.md §7). */
export interface GenProgress {
  lessonId: string
  stage: 'reading' | 'planning' | 'writing' | 'done' | 'error'
  done: number
  total: number
  message?: string
  title?: string
}

export interface DeckBuilderOwnEvents {
  /** The lesson list changed (03 §6). */
  lessonsChanged: LessonSummary[]
  /** An attached document was read for objectives (05 §6). */
  documentRead: { documentId: string; result: Result<DocumentReadResult> }
  /** Generation stages for MessageProgress and the filmstrip skeletons (05 §6). */
  'gen-progress': GenProgress
  /** One generated slide, shown immediately; the deck on disk changes once at the end (05 §6). */
  'slide-ready': { lessonId: string; slide: Slide; index: number }
}

export type DeckBuilderEvents = DeckBuilderOwnEvents & ChatEvents & PluginsEvents

export const LESSONS_METHODS = keysOf<LessonsApi>()([
  'listLessons',
  'pickLoDocument',
  'importLoDocument',
  'createLesson',
  'generate',
  'finishGeneration',
  'cancel',
  'duplicateLesson',
  'renameLesson',
  'deleteLesson',
  'restoreLesson'
])

export const EDITOR_METHODS = keysOf<EditorApi>()([
  'openLesson',
  'applyOps',
  'undo',
  'redo',
  'setStickyNotes',
  'placeAsset',
  'exportPptx',
  'openExport',
  'showExport',
  'present'
])

export const DECK_BUILDER_OWN_EVENTS = keysOf<DeckBuilderOwnEvents>()([
  'lessonsChanged',
  'documentRead',
  'gen-progress',
  'slide-ready'
])

/** Every request channel the module serves (module-local names). */
export const DECK_BUILDER_METHODS = [
  ...LESSONS_METHODS,
  ...EDITOR_METHODS,
  ...CHAT_METHODS,
  ...PLUGINS_METHODS
] as const satisfies readonly (keyof DeckBuilderApi)[]

/** Every event the module emits (module-local names). */
export const DECK_BUILDER_EVENTS = [
  ...DECK_BUILDER_OWN_EVENTS,
  ...CHAT_EVENTS,
  ...PLUGINS_EVENTS
] as const satisfies readonly (keyof DeckBuilderEvents)[]
