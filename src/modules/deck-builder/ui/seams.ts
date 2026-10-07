/**
 * The seams between the deck-builder's UI parts, which are built by different people in parallel.
 * Types only. Each part implements ITS side exactly; changing a shape here needs the lead's sign-off.
 *
 *   router (DeckBuilderView, owned by editor-core)
 *     ├─ NewLessonScreen   (new-lesson part)             <- NewLessonScreenProps
 *     └─ EditorScreen      (editor-core part)
 *          ├─ CircleLayer  (editor-ai part, inside SlideStage)   <- CircleLayerProps
 *          └─ EditorChat   (editor-ai part, the right-hand panel) <- EditorChatProps
 */
import type { Deck, Slide } from '@shared/deck/types'
import type { ChatItem, RegionDraft } from '@shared/contracts/deck-builder-chat'
import type { HistoryState, LessonView } from '@shared/contracts/deck-builder'
import type { StyleProfileView } from '@shared/contracts/style-library'

export type { RegionDraft }

/** The New lesson screen (05). It creates a lesson and hands over to the editor via `onOpenLesson`. */
export interface NewLessonScreenProps {
  /** Called as soon as the lesson exists and generation has started (the editor opens already generating). */
  onOpenLesson(lessonId: string): void
  /** The "My lessons" back button. */
  onBack(): void
  /** Pre-filled from Home's "Make a new lesson" card (title + pasted objectives), if any. */
  prefill?: { title?: string; text?: string }
}

/** The circle tool's drawing layer, rendered by the editor as a child of SlideStage (slide units 1920x1080). */
export interface CircleLayerProps {
  slide: Slide
  /** Regions already placed (all slides); the layer draws the ones on `slide`. */
  regions: RegionDraft[]
  /** A region highlighted because its chip is hovered in the composer or a past message. */
  highlightedRegionId: string | null
  /** True while the circle tool is the active tool. */
  active: boolean
  /** The teacher finished a loop: already simplified, hit-tested and numbered by the layer. */
  onAddRegion(region: RegionDraft): void
  /** Esc / right-click: leave the circle tool. */
  onExit(): void
}

/** The chat panel (06 right-hand side): messages, Composer, + plugin menu, plugin sheet, circle chips. */
export interface EditorChatProps {
  lessonId: string
  deck: Deck
  style: StyleProfileView | null
  /** Messages and the running job from `openLesson`. */
  initialChat: ChatItem[]
  runningJob: LessonView['runningJob']
  /** Currently selected slide ids in the filmstrip (1-based numbering is derived from `deck.slides`). */
  selectedSlideIds: string[]
  currentSlideId: string | null
  /** Circled regions waiting to be sent (owned by the editor so the stage can draw them). */
  regions: RegionDraft[]
  onRegionsChange(next: RegionDraft[]): void
  onHighlightRegion(id: string | null): void
  /** A chat turn, plugin run or undo changed the deck: the editor refreshes slides and Undo/Redo. */
  onLessonChanged(change: { deck: Deck; history: HistoryState }): void
  /** Slides to flash in the filmstrip while a ResultChip is hovered. */
  onHighlightSlides(slideIds: string[]): void
  /** True while the circle tool is active, so the Composer can hint at it. */
  circleToolActive: boolean
  /** "Connect Claude" actions. */
  onConnectClaude(): void
}
