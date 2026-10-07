/**
 * Types and ports of the lessons services. Everything the services need from the outside world
 * (Electron dialogs, the offscreen renderer, the styles service, the clock) comes in through these
 * ports, so the services run in plain Node under test.
 */
import type { LessonBrief, LessonPlan } from '@shared/ai/types'
import type { StrokePath } from '@shared/contracts/deck-builder-chat'
import type {
  DeckBuilderEvents,
  HistoryState,
  LessonView,
  StickyNote
} from '@shared/contracts/deck-builder'
import type { Deck, LessonMeta, Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import type { LessonAssetsPort } from './assetsPort'

/** Emits one of the `deck-builder` module's events (wired to `ctx.emit` by the module). */
export type EmitEvent = <K extends keyof DeckBuilderEvents>(
  name: K,
  payload: DeckBuilderEvents[K]
) => void

/** One slide to draw as a PNG. Implemented by the renderer agent (offscreen `SlideView`). */
export interface SlideRenderRequest {
  slide: Slide
  style: StyleProfile | null
  /** Output size in pixels (the slide is scaled to fit). */
  width: number
  height: number
  /** Reads a lesson asset so pictures can be drawn. */
  readAsset?(assetId: string): Promise<Uint8Array | undefined>
  /** Loops to draw on the slide, in slide units, each with its number. */
  marks?: Array<{ n: number; path: StrokePath }>
  /** Free-hand strokes of the Draw tool, in slide units. */
  strokes?: StrokePath[]
  /** Render only this part of the slide (slide units), scaled to `width` x `height`. */
  crop?: { x: number; y: number; w: number; h: number }
}

/** Draws slides to PNG bytes: thumbnails, `view_slide` and the images of circled regions. */
export interface SlideRendererPort {
  renderSlidePng(request: SlideRenderRequest): Promise<Uint8Array>
}

/** The styles the lessons need: a profile by id (null/unknown = the built-in plain style). */
export interface StyleSource {
  getProfile(styleId: string): Promise<StyleProfile | undefined>
}

/** Native dialogs (Electron `dialog`), injected so tests can answer them. */
export interface DialogPort {
  /** The Save dialog for an export; resolves to the chosen path, or undefined when cancelled. */
  pickSavePath(defaultName: string): Promise<string | undefined>
  /** The Open dialog for one file; resolves to the chosen path, or undefined when cancelled. */
  pickOpenPath(options: { title: string; extensions: string[] }): Promise<string | undefined>
}

/** Moves a folder to the Recycle Bin (Electron `shell.trashItem`). */
export interface TrashPort {
  trashItem(path: string): Promise<void>
}

/** Minimal logger so services never import Electron's. */
export interface Logger {
  warn(message: string): void
  error(message: string): void
}

export const silentLogger: Logger = { warn: () => undefined, error: () => undefined }

/** What a stopped or failed generation left behind, so "Finish the rest" can carry on (05 §7). */
export interface GenerationRecord {
  state: 'partial'
  /** The plan the slides follow. */
  plan: LessonPlan
  brief: LessonBrief
  /** Slide id per plan index, null while not written yet. */
  slideIds: Array<string | null>
  /** Why it stopped (for the message). */
  stoppedBy: 'cancelled' | 'error'
}

/** The message for a lesson id that is unknown or unsafe. */
export const LESSON_NOT_FOUND = 'That lesson can’t be found.'

export interface LessonsServiceDeps {
  /** The module's data folder (`ctx.dataDir`): lessons live in `<dir>/lessons`. */
  dir: string
  styles: StyleSource
  dialogs: DialogPort
  /** Draws thumbnails. Without one, Home shows lessons without pictures. */
  renderer?: SlideRendererPort
  /** The Recycle Bin. Without one, deleted lessons are removed for good when the undo window ends. */
  trash?: TrashPort
  /** Receives `lessonsChanged` whenever the list changes. */
  emit?: EmitEvent
  clock?: () => Date
  ids?: (prefix: string) => string
  log?: Logger
  /** How long a deleted lesson can be brought back (default 10 s). */
  undoWindowMs?: number
  /** Lower-case names of installed fonts, for the export's missing-font warning. */
  installedFonts?: ReadonlySet<string>
  /** The teacher's library: export credits and "Used in" refreshes. Without it lessons simply have no library. */
  assets?: LessonAssetsPort
}

/** Everything the editor shows for one lesson that the lessons service knows (06 §6). */
export interface OpenedLesson {
  deck: Deck
  titleSource: 'auto' | 'user'
  history: HistoryState
  stickyNotes: StickyNote[]
  runningJob: LessonView['runningJob']
}

/** What a new lesson starts from. */
export interface NewLesson {
  /** Only when the teacher typed one (then it counts as set by hand). */
  title?: string | null
  /** Null is the built-in plain style. */
  styleId: string | null
  meta: Partial<LessonMeta>
  /** Start with one empty slide on the style's title layout. */
  blankSlide?: boolean
}
