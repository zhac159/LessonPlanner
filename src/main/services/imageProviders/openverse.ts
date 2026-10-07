/**
 * Openverse (api.openverse.org/v1/images): one search over many CC libraries (Flickr, Wikimedia, museums...).
 * No key needed. Anonymous apps get 20 searches/min and 200/day with at most 20 results a page, so this provider is
 * always wrapped with `polite()` (see index.ts). An optional OAuth token (free registration) lifts the limits.
 */
import { attributionCredit } from './attribution'
import { asArr, asRec, num, requestJson, str } from './http'
import { isFreeToUse, licenceFromCode } from './licences'
import { clip, plainText } from './text'
import {
  DEFAULT_USER_AGENT,
  type FetchFn,
  type ImageKind,
  type ImageSearchItem,
  type ImageSearchProvider
} from './types'

export const OPENVERSE_URL = 'https://api.openverse.org/v1/images/'
const ANON_MAX_PAGE_SIZE = 20
const FREE_LICENCES = 'cc0,pdm,by,by-sa'

const SOURCE_NAMES: Record<string, string> = {
  flickr: 'Flickr',
  wikimedia: 'Wikimedia Commons',
  wikimedia_commons: 'Wikimedia Commons',
  smithsonian: 'Smithsonian',
  nasa: 'NASA',
  rawpixel: 'Rawpixel',
  stocksnap: 'StockSnap',
  geographorg: 'Geograph',
  met: 'The Met',
  europeana: 'Europeana',
  animaldiversity: 'Animal Diversity Web'
}

const sourceName = (raw: string): string =>
  SOURCE_NAMES[raw.toLowerCase()] ??
  (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Openverse')

function categoryFor(kinds: ImageKind[] | undefined): string | undefined {
  if (!kinds?.length) return undefined
  const categories = new Set<string>()
  for (const kind of kinds) {
    if (kind === 'photo') categories.add('photograph')
    else categories.add('illustration')
  }
  return [...categories].join(',')
}

export interface OpenverseOptions {
  fetchFn: FetchFn
  userAgent?: string
  /** An OAuth2 access token from a registered application (optional). */
  getToken?: () => string | undefined
  timeoutMs?: number
}

export function createOpenverseProvider(options: OpenverseOptions): ImageSearchProvider {
  const { fetchFn, userAgent = DEFAULT_USER_AGENT, getToken, timeoutMs } = options
  return {
    id: 'openverse',
    label: 'Openverse',
    async search({ query, page, perPage, freeOnly, kinds, signal }) {
      const url = new URL(OPENVERSE_URL)
      url.searchParams.set('q', query.trim())
      url.searchParams.set('page', String(Math.max(1, page)))
      url.searchParams.set('page_size', String(Math.min(Math.max(1, perPage), ANON_MAX_PAGE_SIZE)))
      url.searchParams.set('mature', 'false')
      if (freeOnly) url.searchParams.set('license', FREE_LICENCES)
      const category = categoryFor(kinds)
      if (category) url.searchParams.set('category', category)
      const token = getToken?.()
      const { data } = await requestJson(fetchFn, url.toString(), {
        service: 'Openverse',
        signal,
        timeoutMs,
        keyed: Boolean(token),
        headers: { 'user-agent': userAgent, ...(token ? { authorization: `Bearer ${token}` } : {}) }
      })
      const body = asRec(data)
      const items: ImageSearchItem[] = []
      for (const raw of asArr(body.results)) {
        const r = asRec(raw)
        const id = str(r.id)
        const fullUrl = str(r.url)
        if (!id || !/^https:\/\//.test(fullUrl)) continue
        if (/\.svg(\?|$)/i.test(fullUrl) || str(r.filetype).toLowerCase() === 'svg') continue
        const licence = licenceFromCode(str(r.license), str(r.license_version), str(r.license_url))
        if (freeOnly && !isFreeToUse(licence)) continue
        const item: Omit<ImageSearchItem, 'attributionText'> = {
          id,
          providerId: 'openverse',
          title: clip(plainText(str(r.title)), 120) || 'Untitled',
          thumbnailUrl: str(r.thumbnail) || fullUrl,
          fullUrl,
          width: num(r.width),
          height: num(r.height),
          source: sourceName(str(r.source) || str(r.provider)),
          sourceUrl: str(r.foreign_landing_url) || fullUrl,
          author: clip(plainText(str(r.creator)), 100),
          authorUrl: str(r.creator_url) || undefined,
          licence
        }
        items.push({ ...item, attributionText: attributionCredit(item) })
      }
      const pageCount = num(body.page_count)
      return { items, hasMore: page < pageCount }
    }
  }
}
