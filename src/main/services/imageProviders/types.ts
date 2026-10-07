/**
 * Shared types of the image provider layer (agents/assets/PROVIDERS.md). Pure TypeScript: no Electron and no DOM;
 * the only I/O is the injected `fetchFn`, so every network call stays in the main process and tests use fixtures.
 */

/** The shape of the global `fetch`, injectable so tests never touch the network. */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

/** What kind of picture the teacher is after (maps to each library's own category filter where it has one). */
export type ImageKind = 'photo' | 'illustration' | 'icon' | 'diagram'

export type LicenceCode =
  | 'cc0'
  | 'pdm'
  | 'by'
  | 'by-sa'
  | 'by-nd'
  | 'by-nc'
  | 'by-nc-sa'
  | 'by-nc-nd'
  | 'pexels'
  | 'unsplash'
  | 'other'

export interface LicenceInfo {
  code: LicenceCode
  /** Human name, e.g. "CC BY-SA 4.0". */
  name: string
  url: string
  /** The licence legally (or by the provider's rules) requires a credit. */
  requiresAttribution: boolean
  /** Commercial use is allowed (false for the NC family and unknown licences). */
  commercialOk: boolean
}

export interface ImageSearchParams {
  query: string
  /** 1-based. */
  page: number
  perPage: number
  /** "Free to use in lessons": CC0, public domain, CC BY, CC BY-SA (and the free-library licences). No NC, no ND. */
  freeOnly: boolean
  kinds?: ImageKind[]
  signal?: AbortSignal
}

export interface ImageSearchItem {
  /** Unique within the provider. */
  id: string
  providerId: string
  title: string
  thumbnailUrl: string
  /** A URL `downloadImage` can fetch (a raster file of a sensible size). */
  fullUrl: string
  width: number
  height: number
  /** Where the picture comes from, for display ("Flickr", "Wikimedia Commons", "Pexels"). */
  source: string
  /** The picture's own page (the credit link). */
  sourceUrl: string
  author: string
  authorUrl?: string
  licence: LicenceInfo
  /** Ready-made credit line for the speaker notes (see `attributionCredit`). */
  attributionText: string
  /** Providers that require "download tracking" (Unsplash) keep the URL to ping here. */
  trackingUrl?: string
}

export interface ImageSearchResult {
  items: ImageSearchItem[]
  hasMore: boolean
}

export interface ImageSearchProvider {
  id: string
  /** Name for the UI tab or chip. */
  label: string
  search(params: ImageSearchParams): Promise<ImageSearchResult>
  /**
   * Call when the teacher actually picks a result (Unsplash requires a download ping then). Never throws; the
   * result says whether the ping was sent. Most providers leave it out.
   */
  registerUse?(item: ImageSearchItem, signal?: AbortSignal): Promise<boolean>
}

/** The default User-Agent. Wikimedia asks for contact details: the shell should pass a real one (see PROVIDERS.md). */
export const DEFAULT_USER_AGENT = 'SlidePlanner/0.1 (desktop lesson planner; Windows)'
