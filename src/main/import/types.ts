/** Shapes produced by the local (no AI) file digests. All coordinates are on the 1920×1080 slide grid. */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface RunDigest {
  text: string
  sizePt?: number
  bold?: boolean
  italic?: boolean
  /** `#RRGGBB` (theme colours already resolved). */
  color?: string
  font?: string
}

export interface ParagraphDigest {
  runs: RunDigest[]
  bullet?: boolean
  level?: number
}

export interface ShapeDigest {
  kind: 'text' | 'shape' | 'picture' | 'table'
  name?: string
  /** Placeholder type from the file, e.g. `title`, `body`. */
  placeholder?: string
  /** Missing when the shape inherits its position from the layout. */
  box?: Box
  geometry?: string
  fill?: string
  line?: string
  paragraphs?: ParagraphDigest[]
}

export interface SlideDigest {
  index: number
  shapes: ShapeDigest[]
  notes?: string
}

export interface Counted<T> {
  value: T
  count: number
}

export interface PptxDigest {
  slideCount: number
  theme: {
    /** Theme colour slots: dk1, lt1, dk2, lt2, accent1..accent6, hlink, folHlink → `#RRGGBB`. */
    colors: Record<string, string>
    fonts: { major: string | null; minor: string | null }
  }
  slides: SlideDigest[]
  stats: {
    colors: Array<Counted<string>>
    fonts: Array<Counted<string>>
    sizesPt: Array<Counted<number>>
  }
  /** True when text looks like it contains personal data (see privacy.ts). */
  mayContainNames: boolean
  warnings: string[]
}

export interface PdfInfo {
  pages: number
  /** Text of the first pages (up to PDF_TEXT_PAGES), one entry per page. */
  pageText: string[]
  mayContainNames: boolean
}

export type SourceKind = 'pdf' | 'pptx'

/** A file that passed validation and may be copied into a style. */
export interface AcceptedFile {
  path: string
  fileName: string
  kind: SourceKind
  size: number
  hash: string
}

export interface RejectedFile {
  fileName: string
  code: import('./errors').ImportFailureCode
  reason: string
}
