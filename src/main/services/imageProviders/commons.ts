/**
 * Wikimedia Commons (commons.wikimedia.org/w/api.php): file search plus `imageinfo` with `extmetadata` (licence,
 * artist, credit). No key, but Wikimedia requires a descriptive User-Agent with contact details, and the search
 * cannot filter by licence, so the licence is read from every result and non-free ones are dropped here.
 */
import { attributionCredit } from './attribution'
import { asArr, asRec, num, requestJson, str, type Rec } from './http'
import { isFreeToUse, parseLicenceText } from './licences'
import { clip, plainText } from './text'
import {
  DEFAULT_USER_AGENT,
  type FetchFn,
  type ImageKind,
  type ImageSearchItem,
  type ImageSearchProvider
} from './types'

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const MAX_PER_PAGE = 50
/** Originals above this are replaced by a 1920px rendering (the download limit is 10 MB). */
const BIG_ORIGINAL_BYTES = 8 * 1024 * 1024
const RASTER = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const META = [
  'ObjectName',
  'LicenseShortName',
  'License',
  'LicenseUrl',
  'Artist',
  'Credit',
  'AttributionRequired',
  'Copyrighted'
].join('|')

/** `.../330px-X.jpg` to `.../1280px-X.jpg` (Commons only renders its standard widths). */
export function resizedThumb(thumbUrl: string, width: number): string {
  return thumbUrl.replace(/\/(\d+)px-([^/?]+)/, `/${width}px-$2`)
}

function filetypeClause(kinds: ImageKind[] | undefined): string {
  if (!kinds?.length || kinds.includes('photo')) return 'filetype:bitmap'
  return 'filetype:bitmap|drawing'
}

const metaValue = (meta: Rec, key: string): string => plainText(str(asRec(meta[key]).value))

export interface CommonsOptions {
  fetchFn: FetchFn
  /** Must identify the app and give contact details (Wikimedia User-Agent policy). */
  userAgent?: string
  timeoutMs?: number
}

export function createCommonsProvider(options: CommonsOptions): ImageSearchProvider {
  const { fetchFn, userAgent = DEFAULT_USER_AGENT, timeoutMs } = options
  return {
    id: 'commons',
    label: 'Wikimedia Commons',
    async search({ query, page, perPage, freeOnly, kinds, signal }) {
      const limit = Math.min(Math.max(1, perPage), MAX_PER_PAGE)
      const url = new URL(COMMONS_API)
      const params: Record<string, string> = {
        action: 'query',
        format: 'json',
        formatversion: '2',
        generator: 'search',
        gsrnamespace: '6',
        gsrsearch: `${query.trim()} ${filetypeClause(kinds)}`,
        gsrlimit: String(limit),
        gsroffset: String((Math.max(1, page) - 1) * limit),
        prop: 'imageinfo',
        iiprop: 'url|size|mime|extmetadata',
        iiurlwidth: '330',
        iiextmetadatafilter: META
      }
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
      const { data } = await requestJson(fetchFn, url.toString(), {
        service: 'Wikimedia Commons',
        signal,
        timeoutMs,
        headers: { 'user-agent': userAgent, 'api-user-agent': userAgent }
      })
      const body = asRec(data)
      const pages = asArr(asRec(body.query).pages)
        .map(asRec)
        .sort((a, b) => num(a.index) - num(b.index))
      const items: ImageSearchItem[] = []
      for (const p of pages) {
        const info = asRec(asArr(p.imageinfo)[0])
        const mime = str(info.mime)
        const isSvg = mime === 'image/svg+xml'
        if (!RASTER.has(mime) && !isSvg) continue
        const meta = asRec(info.extmetadata)
        const licenceText = metaValue(meta, 'LicenseShortName') || metaValue(meta, 'License')
        const licence = parseLicenceText(licenceText, str(asRec(meta.LicenseUrl).value))
        if (freeOnly && !isFreeToUse(licence)) continue
        if (metaValue(meta, 'AttributionRequired').toLowerCase() === 'true')
          licence.requiresAttribution = true
        const thumb = str(info.thumburl)
        const original = str(info.url)
        if (!thumb || !original) continue
        // SVG is never fetched as SVG: Commons renders a PNG, which is also what lets a diagram through safely.
        const fullUrl = isSvg
          ? resizedThumb(thumb, 1280)
          : num(info.size) > BIG_ORIGINAL_BYTES
            ? resizedThumb(thumb, 1920)
            : original
        const title = str(p.title)
        const item: Omit<ImageSearchItem, 'attributionText'> = {
          id: String(num(p.pageid) || title),
          providerId: 'commons',
          title: clip(
            metaValue(meta, 'ObjectName') ||
              title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
            120
          ),
          thumbnailUrl: thumb,
          fullUrl,
          width: num(info.width),
          height: num(info.height),
          source: 'Wikimedia Commons',
          sourceUrl: str(info.descriptionurl) || original,
          author: clip(metaValue(meta, 'Artist') || metaValue(meta, 'Credit'), 100),
          licence
        }
        items.push({ ...item, attributionText: attributionCredit(item) })
      }
      return { items, hasMore: 'continue' in body }
    }
  }
}
