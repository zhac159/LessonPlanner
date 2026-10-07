/**
 * The two optional photo libraries that need a free key the teacher pastes in (kept in main, like the Claude key):
 * Pexels and Unsplash. Both are small and both are off until a key exists. `getKey` is read on every call.
 */
import { attributionCredit } from './attribution'
import { asArr, asRec, num, requestJson, str } from './http'
import { ImageProviderError } from './errors'
import { licenceFromCode } from './licences'
import {
  DEFAULT_USER_AGENT,
  type FetchFn,
  type ImageKind,
  type ImageSearchItem,
  type ImageSearchProvider
} from './types'

export interface KeyedOptions {
  fetchFn: FetchFn
  getKey: () => string | undefined
  userAgent?: string
  timeoutMs?: number
}

/** Photo libraries have photographs only: a search for icons or diagrams is answered with nothing. */
const wantsPhotos = (kinds: ImageKind[] | undefined): boolean =>
  !kinds?.length || kinds.includes('photo')

function requireKey(getKey: () => string | undefined, service: string): string {
  const key = getKey()?.trim()
  if (!key)
    throw new ImageProviderError('no-key', `Add a ${service} key in Settings to search ${service}.`)
  return key
}

/** Pexels: GET /v1/search, `Authorization: <key>`; 200 requests/hour, 20,000/month. */
export function createPexelsProvider(options: KeyedOptions): ImageSearchProvider {
  const { fetchFn, getKey, userAgent = DEFAULT_USER_AGENT, timeoutMs } = options
  return {
    id: 'pexels',
    label: 'Pexels',
    async search({ query, page, perPage, kinds, signal }) {
      const key = requireKey(getKey, 'Pexels')
      if (!wantsPhotos(kinds)) return { items: [], hasMore: false }
      const url = new URL('https://api.pexels.com/v1/search')
      url.searchParams.set('query', query.trim())
      url.searchParams.set('page', String(Math.max(1, page)))
      url.searchParams.set('per_page', String(Math.min(Math.max(1, perPage), 80)))
      const { data } = await requestJson(fetchFn, url.toString(), {
        service: 'Pexels',
        signal,
        timeoutMs,
        keyed: true,
        headers: { authorization: key, 'user-agent': userAgent }
      })
      const body = asRec(data)
      const items: ImageSearchItem[] = []
      for (const raw of asArr(body.photos)) {
        const p = asRec(raw)
        const src = asRec(p.src)
        const fullUrl = str(src.large2x) || str(src.large) || str(src.original)
        const id = String(num(p.id) || '')
        if (!id || !fullUrl) continue
        const item: Omit<ImageSearchItem, 'attributionText'> = {
          id,
          providerId: 'pexels',
          title: str(p.alt) || 'Photo from Pexels',
          thumbnailUrl: str(src.medium) || str(src.small) || fullUrl,
          fullUrl,
          width: num(p.width),
          height: num(p.height),
          source: 'Pexels',
          sourceUrl: str(p.url),
          author: str(p.photographer),
          authorUrl: str(p.photographer_url) || undefined,
          licence: licenceFromCode('pexels')
        }
        items.push({ ...item, attributionText: attributionCredit(item) })
      }
      return { items, hasMore: typeof body.next_page === 'string' && body.next_page.length > 0 }
    }
  }
}

const UNSPLASH_UTM = 'utm_source=slide_planner&utm_medium=referral'
const withUtm = (url: string): string =>
  url ? `${url}${url.includes('?') ? '&' : '?'}${UNSPLASH_UTM}` : ''

/**
 * Unsplash: GET /search/photos, `Authorization: Client-ID <key>`; 50 requests/hour in demo mode. Its guidelines
 * require hotlinked `urls.*` (used as given), credit with UTM links, and a ping to `links.download_location` when a
 * photo is actually chosen: that ping is `registerUse`.
 */
export function createUnsplashProvider(options: KeyedOptions): ImageSearchProvider {
  const { fetchFn, getKey, userAgent = DEFAULT_USER_AGENT, timeoutMs } = options
  const headers = (key: string): Record<string, string> => ({
    authorization: `Client-ID ${key}`,
    'accept-version': 'v1',
    'user-agent': userAgent
  })
  return {
    id: 'unsplash',
    label: 'Unsplash',
    async search({ query, page, perPage, kinds, signal }) {
      const key = requireKey(getKey, 'Unsplash')
      if (!wantsPhotos(kinds)) return { items: [], hasMore: false }
      const url = new URL('https://api.unsplash.com/search/photos')
      url.searchParams.set('query', query.trim())
      url.searchParams.set('page', String(Math.max(1, page)))
      url.searchParams.set('per_page', String(Math.min(Math.max(1, perPage), 30)))
      url.searchParams.set('content_filter', 'high')
      const { data } = await requestJson(fetchFn, url.toString(), {
        service: 'Unsplash',
        signal,
        timeoutMs,
        keyed: true,
        headers: headers(key)
      })
      const body = asRec(data)
      const items: ImageSearchItem[] = []
      for (const raw of asArr(body.results)) {
        const p = asRec(raw)
        const urls = asRec(p.urls)
        const links = asRec(p.links)
        const user = asRec(p.user)
        const id = str(p.id)
        const fullUrl = str(urls.regular) || str(urls.full)
        if (!id || !fullUrl) continue
        const item: Omit<ImageSearchItem, 'attributionText'> = {
          id,
          providerId: 'unsplash',
          title: str(p.description) || str(p.alt_description) || 'Photo from Unsplash',
          thumbnailUrl: str(urls.small) || str(urls.thumb) || fullUrl,
          fullUrl,
          width: num(p.width),
          height: num(p.height),
          source: 'Unsplash',
          sourceUrl: withUtm(str(links.html)),
          author: str(user.name),
          authorUrl: withUtm(str(asRec(user.links).html)) || undefined,
          licence: licenceFromCode('unsplash'),
          trackingUrl: str(links.download_location) || undefined
        }
        items.push({ ...item, attributionText: attributionCredit(item) })
      }
      return { items, hasMore: page < num(body.total_pages) }
    },
    async registerUse(item, signal) {
      const key = getKey()?.trim()
      if (!key || !item.trackingUrl) return false
      try {
        await requestJson(fetchFn, item.trackingUrl, {
          service: 'Unsplash',
          signal,
          timeoutMs,
          keyed: true,
          headers: headers(key)
        })
        return true
      } catch {
        return false
      }
    }
  }
}
