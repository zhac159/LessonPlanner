/**
 * Shapes of the "Your assets" extraction service (agents/ASSETS.md, desing_asset/README.md screens A1-A2).
 * Pure data: no Electron, no Node-only types besides Uint8Array. Boxes use the 1920x1080 slide grid.
 */
import type { Box } from '../types'
import type { ZipLimits } from './limits'

export type { Box }

export type ImageMime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/webp'
  | 'image/bmp'
  | 'image/tiff'
  | 'image/svg+xml'
  | 'image/x-emf'
  | 'image/x-wmf'

/** What the picture looks like it is. A hint for naming and for the review screen, never a guarantee. */
export type KindHint = 'logo' | 'symbol-card' | 'photo' | 'icon' | 'banner' | 'other'

/** Where in the file the picture came from. */
export type ImageOrigin =
  | 'slide' // a picture shape on a slide / an image drawn on a PDF page
  | 'layout' // on a slide layout (shows on every slide using it)
  | 'master' // on the slide master
  | 'fill' // a picture fill of a shape
  | 'background' // the slide background

/** Fractions (0..1) trimmed away from each side of the bitmap (a:srcRect, or a rectangular PDF clip). */
export interface CropRect {
  l: number
  t: number
  r: number
  b: number
}

export interface ImageQuality {
  /** Under ~48 px (natural or placed): a decorative bit, ignored when grouping. */
  tooSmall: boolean
  /** A line or a thin strip (extreme aspect ratio): ignored when grouping. */
  thin: boolean
  /** Few pixels for how large it is shown (or very few pixels overall). */
  lowResolution: boolean
  /** Estimated from edge sharpness; `blurScore` is the 98th percentile of the gradient (null = unknown/flat). */
  blurry: boolean
  blurScore: number | null
  /** Covers (nearly) the whole page: a scan or a page screenshot, never a reusable asset. */
  fullPage: boolean
  /** Could not be decoded (EMF/WMF/odd format): kept with its bytes, no pixel checks. */
  unreadable: boolean
}

export interface ExtractedImage {
  /** `<fileName>#<unit>.<n>`, unique inside one extraction. */
  id: string
  fileName: string
  sourceKind: 'pptx' | 'pdf'
  /** Slide or page number (1-based). For layout/master pictures: the first slide that shows it. */
  pageOrSlide: number
  origin: ImageOrigin
  /** The picture exactly as stored in the file when possible (JPEG/PNG pass-through), else a lossless PNG. */
  bytes: Uint8Array
  mime: ImageMime
  /** Natural size in pixels (0 when unreadable). */
  width: number
  height: number
  /** sha256 hex of `bytes`. */
  hash: string
  /** 64-bit dHash (16 hex chars); '' when unreadable. */
  perceptualHash: string
  /** 256-bit finer dHash (64 hex chars) used to confirm near duplicates; '' when unreadable. */
  detailHash: string
  /** 3x3 mean-colour signature (54 hex chars); '' when unreadable. */
  colorSignature: string
  /** Where it is shown, on the 1920x1080 grid (the visible part when cropped). */
  box: Box
  /** Degrees clockwise, 0 for upright. */
  rotation: number
  /** The visible part of the bitmap, when cropped. */
  crop?: CropRect
  /** Every slide/page showing this same picture (sorted, includes this one). */
  repeatedOn: number[]
  /** Text on the slide/page right next to or over the picture (a label under a card, a caption). */
  nearbyText: string
  /** All text of the slide/page (capped). */
  slideText: string
  /** Alt text / shape name from the file, if any. */
  altText?: string
  kindHint: KindHint
  /** Short human reasons for the kind hint (debugging, tooltips). */
  kindReasons: string[]
  /** How many cards a plain-background grid split finds in it (0 = not a card sheet). */
  cardCount: number
  quality: ImageQuality
  /** HEURISTIC: a photo that might show pupils (portrait/group shape, skin tones, class words nearby). */
  maybePupils: boolean
  pupilReasons: string[]
  /** `id` of an earlier extracted image with the very same bytes. */
  duplicateOf?: string
}

export interface ExtractionResult {
  fileName: string
  sourceKind: 'pptx' | 'pdf'
  /** Slides or pages in the file. */
  units: number
  images: ExtractedImage[]
  /** The PDF is (nearly) only full-page pictures with no text: scanned, nothing reusable inside. */
  scanned: boolean
  /** Readable notes about what could not be read (never thrown). */
  warnings: string[]
}

export interface ExtractProgress {
  done: number
  total: number
}

export interface ExtractOptions {
  /** Stops reading further slides/pages. */
  signal?: AbortSignal
  /** Progress per slide/page, for "Cutting out pictures · page 4 of 6". */
  onProgress?: (progress: ExtractProgress) => void
  /** Stop after this many picture occurrences (default 400). */
  maxImages?: number
  /** Only the first N slides/pages are read (default 300). */
  maxUnits?: number
  /** Pictures with more pixels than this are not decoded (default 40 million). */
  maxPixels?: number
  /** Override the pixel decoder (tests, or Electron's nativeImage in the app). */
  decode?: ImageDecoder
  /** Caps on what a .pptx may inflate to (defaults 50 MB per picture, 5 MB per XML part, 500 MB in all). */
  zipLimits?: Partial<ZipLimits>
}

export interface Raster {
  width: number
  height: number
  /** RGBA, 4 bytes per pixel. */
  data: Uint8ClampedArray
}

/** Turns encoded bytes into pixels; returns null for formats it cannot read. */
export type ImageDecoder = (bytes: Uint8Array, mime: ImageMime) => Promise<Raster | null>

/** Why a found asset is left unticked in the review screen (A2 badges). */
export type LeftOutReason =
  | 'pupils' // May show pupils
  | 'blurry'
  | 'older-version' // a near-duplicate of a better version
  | 'low-resolution'
  | 'background'
  | 'unreadable'

export interface FoundIn {
  fileName: string
  /** Slides/pages of that file where it appears. */
  units: number[]
}

/** One row of the review screen: ONE picture merged from all its occurrences. */
export interface FoundAsset {
  /** Stable id: the first 16 hex chars of the representative's sha256. */
  id: string
  /** The best occurrence: its bytes are what gets saved. */
  image: ExtractedImage
  kind: KindHint
  /** snake_case chat name proposal (`school_logo`), unique inside the list; the teacher can rename it. */
  suggestedName: string
  /** Total slides/pages it appears on, over all files ("In 24 decks" is computed by the caller across files). */
  foundOn: number
  foundIn: FoundIn[]
  /** Text found near it, joined (best occurrence first). */
  nearbyText: string
  /** Ticked in the review screen by default. */
  keep: boolean
  leftOut?: LeftOutReason
  /** Best-effort flag for a photo that might show pupils: the teacher must confirm (heuristic, see pupils.ts). */
  needsReview: boolean
  reviewReasons: string[]
  /** For `older-version`: id of the asset this is an older/near copy of. */
  olderVersionOf?: string
  /** Ids of every extracted occurrence merged here. */
  occurrenceIds: string[]
}

export interface IgnoredCounts {
  tooSmall: number
  thin: number
  fullPage: number
}

export interface Findings {
  assets: FoundAsset[]
  ignored: IgnoredCounts
  /** `Found 12 · keeping 9` */
  found: number
  keeping: number
}

export interface CardRegion {
  /** In pixels of the source bitmap. */
  box: Box
  row: number
  col: number
  bytes: Uint8Array
  mime: 'image/png'
  width: number
  height: number
  /** Word from the nearby text when it can be assigned in reading order. */
  label?: string
}

export interface CardSplit {
  cards: CardRegion[]
  /** Always true today: a plain-background region split is a guess; the review screen must show the result. */
  experimental: true
  /** 0..1 */
  confidence: number
}
