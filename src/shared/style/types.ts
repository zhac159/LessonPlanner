/**
 * StyleProfile: how the app learns "her style" (design/style-profile.md §1).
 * Pure types: no runtime code here (see schema.ts for validation).
 */
import type { PictureHabits } from '../assets/types'
import type { Element, Slide, SlideKind } from '../deck/types'

export type ColorToken = string // background, text, accent, accent2?, highlight, chipBg, chipText, muted, placeholder, …

export interface StyleProfile {
  schemaVersion: 1
  id: string
  name: string // "Science KS3"
  version: number // +1 on every change (corrections, new files)
  isDefault: boolean
  status: 'draft' | 'learning' | 'ready' | 'failed'

  tokens: {
    colors: Record<ColorToken, { hex: string; label: string; usage: string }>
    fonts: { title: FontSpec; body: FontSpec; accent?: FontSpec }
  }

  components: Record<string, ComponentStyle> // "title", "kicker", "chip", "callout.mini-whiteboard", …
  layouts: LayoutTemplate[]
  slideTypes: SlideTypeHabit[]
  lessonFlow: SlideKind[]
  voice: VoiceProfile
  habits: string[] // human-readable bullets shown in "Layout habits"
  exemplars: Exemplar[]
  sources: SourceRef[]
  corrections: Correction[]
  /** How she uses pictures (built locally from her decks, agents/ASSETS.md §2.6). Optional: old profiles have none. */
  pictures?: PictureHabits
  /** Font families she uses that the app does not bundle: another PC needs them installed (export warning). */
  fontsNeeded?: string[]
  confidence: Record<
    'colors' | 'fonts' | 'layouts' | 'voice' | 'slideTypes',
    'low' | 'medium' | 'high'
  >
  createdAt: string
  updatedAt: string
}

export interface FontSpec {
  family: string
  weight: 400 | 500 | 600 | 700 | 800
  sizePt: number
  sizeRangePt?: [number, number]
  fallbackStack: string
  available: boolean // can the app render it offline? (bundled or installed)
}

export interface ComponentStyle {
  description: string
  font?: 'title' | 'body' | 'accent'
  sizePt?: number
  bold?: boolean
  color?: string // token or hex
  fill?: string
  radius?: number
  padding?: [number, number]
  uppercase?: boolean
  letterSpacingEm?: number
  rules?: string[]
}

export interface LayoutRegion {
  name: string
  elementType: Element['type']
  x: number
  y: number
  w: number
  h: number
  styleRef?: string
  optional?: boolean
}

export interface LayoutTemplate {
  id: string
  name: string
  usedFor: SlideKind[]
  regions: LayoutRegion[]
  decorations: string[] // component keys always drawn
}

export interface SlideTypeHabit {
  kind: SlideKind
  name: string
  frequency: 'always' | 'often' | 'sometimes'
  description: string
  typicalPosition?: 'start' | 'middle' | 'end' | 'repeated'
  exampleText?: string
}

export interface VoiceProfile {
  spelling: 'en-GB' | 'en-US'
  readingAge?: string
  rules: string[]
  phrases: string[]
  questionStyle?: string
}

export interface Exemplar {
  sourceId: string
  page: number
  kind: SlideKind
  digest: Slide
  why: string
}

export interface SourceRef {
  id: string
  fileName: string
  kind: 'pdf' | 'pptx'
  pages: number
  status: 'waiting' | 'reading' | 'learned' | 'failed'
  error?: string
  addedAt: string
}

export interface Correction {
  text: string
  at: string
  appliedInVersion: number
}
