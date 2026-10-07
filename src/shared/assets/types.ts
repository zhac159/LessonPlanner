/**
 * "Your assets": the data model of the teacher's reusable pictures (agents/ASSETS.md §2).
 * Pure types: no runtime code except the constant tables below (validation lives in schema.ts).
 */
import type { Box } from '../deck/layout'
import type { SlideKind } from '../deck/types'

/** Ids look like `ast_01J…` (see `newId('ast')` in @shared/ids). They are also the file id inside lessons. */
export const ASSET_ID_PREFIX = 'ast'

export const ASSET_KINDS = [
  'logo',
  'icon',
  'picture',
  'photo',
  'diagram',
  'banner',
  'character',
  'symbol-card'
] as const

/**
 * What the picture is. `picture` is an illustration, drawing or AI-made scene; `photo` is a real photograph;
 * `symbol-card` is a pictogram card (a word and a picture in a bordered card) used for vocabulary and sorting.
 */
export type AssetKind = (typeof ASSET_KINDS)[number]

export const ASSET_KIND_LABELS: Readonly<Record<AssetKind, string>> = {
  logo: 'Logo',
  icon: 'Icon',
  picture: 'Picture',
  photo: 'Photo',
  diagram: 'Diagram',
  banner: 'Banner',
  character: 'Character',
  'symbol-card': 'Symbol card'
}

export const ASSET_FILE_EXTENSIONS = ['.png', '.jpg', '.webp', '.gif', '.svg'] as const
export type AssetFileExt = (typeof ASSET_FILE_EXTENSIONS)[number]

export const ASSET_MIME: Readonly<Record<AssetFileExt, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
}

/** The stored original (`library/<id>/file<ext>`). Thumbnails are derived (`thumb.png`), never stored here. */
export interface AssetFile {
  ext: AssetFileExt
  /** Pixels; for SVG the viewBox size scaled so the long side is 1024. */
  width: number
  height: number
  bytes: number
  /** Hex SHA-256 of the file: exact-duplicate check and cache key for Claude's descriptions. */
  sha256: string
  /** 64-bit difference hash as 16 hex characters (shared/assets/hash.ts); null for files that could not be decoded. */
  phash: string | null
  /** True for SVG: scales without blur, never flagged low resolution. */
  vector: boolean
  /**
   * SVG only: parts of the file the app leaves out when it draws the picture (see sanitiseSvg `lost`). The file on
   * disk is never changed; this is what the "Some parts are not shown" notice lists. Absent when nothing is left out.
   */
  dropped?: string[]
}

// ---- licences and credits ---------------------------------------------------------------------

export type LicenceId =
  | 'own'
  | 'unknown'
  | 'generated'
  | 'cc0'
  | 'public-domain'
  | 'cc-by'
  | 'cc-by-sa'
  | 'cc-by-nc'
  | 'cc-by-nc-sa'
  | 'cc-by-nc-nd'
  | 'cc-by-nd'
  | 'pexels'
  | 'unsplash'
  | 'other'

export interface AssetLicence {
  id: LicenceId
  /** What the teacher reads: "CC BY-SA 4.0", "Public domain", "From your files". */
  label: string
  /** True when the licence asks for a credit (written into the speaker notes of slides that use it). */
  requiresCredit: boolean
}

export type OnlineProvider = 'openverse' | 'wikimedia' | 'pexels' | 'unsplash'

/**
 * Who made a picture and where it came from, kept with the asset forever. `text` is the plain credit line built
 * once when the asset is saved (`attributionCredit` in src/main/services/imageProviders/attribution.ts), so the
 * app has ONE builder; `inNotes` says whether slides that use the picture must carry it in their speaker notes.
 */
export interface AssetCredit {
  text: string
  inNotes: boolean
  /** The library it came from; null for pictures made with the picture maker. */
  provider: OnlineProvider | null
  author: string | null
  /** The picture's own title on the source site. */
  title: string | null
  /** The page the picture was found on ("Open source page ↗"). */
  pageUrl: string | null
  licenceUrl: string | null
}

// ---- where an asset came from -----------------------------------------------------------------

export type AssetSourceKind = 'uploaded' | 'extracted' | 'online' | 'generated'

export type AssetSource =
  | { kind: 'uploaded'; fileName: string; at: string }
  | {
      kind: 'extracted'
      /** Style whose learning found it; null when cut out of a PDF or PowerPoint she uploaded on the Assets page. */
      styleId: string | null
      fileName: string
      page: number | null
      at: string
    }
  | { kind: 'online'; provider: OnlineProvider; at: string }
  | {
      kind: 'generated'
      /** Model id from the single table in shared/assets/pictureMaker.ts, or 'claude-svg' for drawings. */
      model: string
      prompt: string
      /** Assets whose look it was made to match. */
      basedOn: string[]
      at: string
    }

/** One place an extracted asset was seen (A1 "Found in", A2 "In 24 decks"). */
export interface AssetFoundIn {
  styleId: string | null
  /** SourceRef.id inside that style. */
  sourceId: string
  fileName: string
  /** Page or slide number (1-based) of the first sighting in that file; null when unknown. */
  page: number | null
}

// ---- the asset --------------------------------------------------------------------------------

export interface Asset {
  id: string
  /** The chat name: unique, lower_snake, 2-32 characters (see names.ts). `{{name}}` in chat. */
  name: string
  /** The friendly label on cards and in the detail pane: "School logo". */
  title: string
  kind: AssetKind
  /** What Claude reads ("School crest: navy shield…"). Plain sentences, at most 400 characters. */
  description: string
  tags: string[]
  source: AssetSource
  licence: AssetLicence
  credit: AssetCredit | null
  file: AssetFile
  /** Decks (style sources) it was found in. Empty for uploads and online pictures. */
  foundIn: AssetFoundIn[]
  /** Lesson ids that use it: a CACHE rebuilt by scanning the lessons, never edited by hand. */
  usedIn: string[]
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

/** The whole library as stored in `index.json` (a cache: it can be rebuilt from the per-asset `meta.json`). */
export interface AssetIndex {
  schemaVersion: 1
  assets: Asset[]
  updatedAt: string
}

/** A name pinned to the id it meant when the message was written, so renames and deletes cannot break old chat. */
export interface ChatAssetRef {
  assetId: string
  name: string
}

// ---- picture spots and picture habits ---------------------------------------------------------

/**
 * The extra detail an image element's `placeholder` may carry (the Deck schema stays backwards compatible:
 * every key is optional and an old `{ description }` is already a valid spot). A spot is an ImageElement with
 * no `assetId` and a `placeholder`; filling it sets `assetId` and leaves the placeholder as provenance.
 */
export interface PictureSpotInfo {
  description: string
  /** The kind of picture that would fit. */
  kind?: AssetKind
  /** Words to search online with; defaults to the description. */
  query?: string
  /** Asset ids Claude thinks would do, best first (shown first in the spot sheet). */
  suggestedAssets?: string[]
}

export const ANCHORS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right'
] as const
export type Anchor = (typeof ANCHORS)[number]

/** "school_logo goes top-right on every title slide, 220 units wide" (learned from her decks). */
export interface PicturePlacementRule {
  assetId: string
  /** `every` means every slide. */
  slideKind: SlideKind | 'every'
  anchor: Anchor
  /** Width in slide units (1920 wide); the height follows the picture's own shape. */
  widthUnits: number
  marginUnits: number
  /** In how many of her decks the pattern was seen (confidence). */
  decks: number
}

export type PictureUse = 'always' | 'usually' | 'sometimes' | 'never'

/** What the style learned about her pictures (StyleProfile.pictures, optional so old profiles still parse). */
export interface PictureHabits {
  /**
   * Plain-English lines for "Picture habits" (A6) EXCEPT the per-asset ones, which are written from
   * `placements` with the assets' current names: general position and size, the kinds she uses, where she never uses any.
   */
  lines: string[]
  slideKinds: Array<{ kind: SlideKind; pictures: PictureUse; typicalBox: Box | null }>
  placements: PicturePlacementRule[]
}
