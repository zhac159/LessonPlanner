/**
 * The Deck model: the single source of truth for a lesson (design/deck-model.md §2).
 * `.pptx` is only an export. Pure types: no runtime code here (see schema.ts for validation).
 */

import type { PictureSpotInfo } from '../assets/types'

export interface Deck {
  schemaVersion: 1
  id: string // ULID with prefix, see @shared/ids
  title: string // "Y8 Science — Photosynthesis"
  meta: LessonMeta
  styleId: string | null // StyleProfile used; null = plain default style
  styleVersion: number | null // StyleProfile.version at generation time
  size: { width: 1920; height: 1080 }
  slides: Slide[]
  createdAt: string // ISO 8601
  updatedAt: string
}

export interface LessonMeta {
  subject?: string
  yearGroup?: string // free text: schools differ
  durationMin?: number
  ability?: string
  targetSlideCount?: number
  objectives: string[] // learning objectives, verbatim from the teacher
  context?: string
}

export interface Slide {
  id: string
  kind: SlideKind
  layoutId?: string // StyleProfile.layouts[].id
  background?: Fill
  elements: Element[] // painted in array order (later = on top) unless z is set
  notes?: string // speaker notes, plain text with \n
  source?: { by: 'ai' | 'user' | 'plugin'; pluginId?: string }
}

export type SlideKind =
  | 'title'
  | 'do-now'
  | 'objectives'
  | 'key-words'
  | 'content'
  | 'question'
  | 'activity'
  | 'practical'
  | 'check'
  | 'plenary'
  | 'exit-ticket'
  | 'quiz'
  | 'answers'
  | 'section'
  | 'custom'

export interface ElementBase {
  id: string
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  z?: number
  locked?: boolean // style decorations (e.g. the teal left band) are locked
  styleRef?: string // key into StyleProfile.components
  name?: string // human label used in prompts: "photo", "objectives list"
}

export type Element =
  | TextElement
  | ChipsElement
  | CalloutElement
  | ImageElement
  | DiagramElement
  | ShapeElement
  | TableElement

export type TextRole = 'title' | 'kicker' | 'subtitle' | 'heading' | 'body' | 'caption' | 'label'

export interface TextElement extends ElementBase {
  type: 'text'
  role: TextRole
  paragraphs: Paragraph[]
  align?: 'left' | 'center' | 'right'
  valign?: 'top' | 'middle' | 'bottom'
  fontSizePt?: number
  autoFit?: 'shrink' | 'none' // default 'shrink'
}

export interface Paragraph {
  runs: Run[]
  list?: 'none' | 'bullet' | 'number' | 'checkbox'
  level?: 0 | 1 | 2
}

export interface Run {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: ColorValue // two-colour titles: last words "token:accent"
}

export interface ChipsElement extends ElementBase {
  type: 'chips'
  items: string[]
}

/** Where a speech bubble's tail sits: on the bubble's edge, pointing out of it. */
export type CalloutTail =
  'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'left' | 'right' | 'none'

export interface CalloutElement extends ElementBase {
  type: 'callout'
  variant: string // component key without prefix: "mini-whiteboard", "do-now", "warning", "speech-bubble"
  label?: string // rendered bold
  paragraphs: Paragraph[]
  /** Only for `variant: 'speech-bubble'`: which edge the wedge tail points from (default 'bottom-left'). */
  tail?: CalloutTail
}

export interface ImageElement extends ElementBase {
  type: 'image'
  assetId?: string // file in the lesson's assets folder
  /** An image with a placeholder and no `assetId` is a picture spot (agents/ASSETS.md §2.3). */
  placeholder?: PictureSpotInfo
  fit: 'cover' | 'contain'
  alt: string
  radius?: number
}

export interface DiagramElement extends ElementBase {
  type: 'diagram'
  svg: string // sanitised SVG (deck-model.md §6)
  alt: string
}

export interface ShapeElement extends ElementBase {
  type: 'shape'
  shape: 'rect' | 'roundRect' | 'ellipse' | 'line' | 'arrow'
  fill?: Fill
  stroke?: Stroke
  radius?: number
}

export interface TableElement extends ElementBase {
  type: 'table'
  rows: string[][]
  headerRow: boolean
  colWidths?: number[] // units; must sum to w
}

export type ColorValue = `token:${string}` | `#${string}`
export interface Fill {
  color: ColorValue
  opacity?: number
}
export interface Stroke {
  color: ColorValue
  width: number
  dash?: 'solid' | 'dash'
}

// ---- Editing: operations are the only way to change a deck (deck-model.md §3) ----

export interface ChangeSet {
  id: string
  by: 'user' | 'ai' | 'plugin'
  pluginId?: string
  summary: string // "Replaced the photo on slide 3 with a labelled leaf diagram"
  ops: DeckOp[]
  at: string
}

export type DeckOp =
  | { op: 'insertSlides'; afterSlideId: string | null; slides: Slide[] } // null = at start
  | { op: 'deleteSlides'; slideIds: string[] }
  | { op: 'moveSlide'; slideId: string; afterSlideId: string | null }
  | { op: 'replaceSlide'; slide: Slide } // same id
  | {
      op: 'updateSlide'
      slideId: string
      set: Partial<Pick<Slide, 'kind' | 'layoutId' | 'background' | 'notes'>>
    }
  | { op: 'addElement'; slideId: string; element: Element }
  | { op: 'updateElement'; slideId: string; elementId: string; set: Partial<Element> }
  | { op: 'removeElement'; slideId: string; elementId: string }
  | { op: 'setMeta'; title?: string; meta?: Partial<LessonMeta> }

export const SLIDE_WIDTH = 1920
export const SLIDE_HEIGHT = 1080
