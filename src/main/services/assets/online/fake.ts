/**
 * Offline stand-ins for the image libraries (SLIDE_PLANNER_FAKE_AI=1, tests, screenshots): two providers that
 * answer from fixtures with licences of every kind, and a `fetch` that serves small generated PNGs for their
 * `https://fake.invalid/...` addresses. No test touches the network (agents/ASSETS.md §7 "Fake AI").
 */
import { licenceFromCode } from '../../imageProviders/licences'
import { attributionCredit } from '../../imageProviders/attribution'
import type {
  FetchFn,
  ImageSearchItem,
  ImageSearchProvider,
  LicenceCode
} from '../../imageProviders/types'
import { encodePng } from '../../../import/assets/png'

export const FAKE_HOST = 'fake.invalid'

/** Free licences first, then the ones the "Free to use in lessons" filter hides. */
const LICENCES: Array<{ code: LicenceCode; version?: string }> = [
  { code: 'by-sa', version: '4.0' },
  { code: 'cc0', version: '1.0' },
  { code: 'by', version: '2.0' },
  { code: 'pdm' },
  { code: 'by-nc', version: '4.0' },
  { code: 'by-nd', version: '2.0' }
]

const SUBJECTS = ['close up', 'diagram', 'drawing', 'in the garden', 'seen from above', 'labelled']

function fakeItem(
  providerId: string,
  source: string,
  query: string,
  index: number
): ImageSearchItem {
  const { code, version } = LICENCES[index % LICENCES.length]!
  const licence = licenceFromCode(code, version)
  const title = `${query} ${SUBJECTS[index % SUBJECTS.length]} ${index + 1}`
  const base = `https://${FAKE_HOST}/${providerId}/${encodeURIComponent(query)}/${index}`
  const item = {
    id: `${providerId}-${index}`,
    providerId,
    title,
    thumbnailUrl: `${base}/thumb.png`,
    fullUrl: `${base}/full.png`,
    width: 1600,
    height: 1200,
    source,
    sourceUrl: `https://${FAKE_HOST}/page/${providerId}/${index}`,
    author: index % 2 === 0 ? 'A. Teacher' : 'Sam Photographer',
    licence
  }
  return { ...item, attributionText: attributionCredit(item) }
}

/** Openverse-like and Commons-like providers: 2 pages of any size, the filter drops NC and ND. */
export function createFakeSearchProviders(): ImageSearchProvider[] {
  const make = (id: string, label: string, source: string): ImageSearchProvider => ({
    id,
    label,
    async search({ query, page, perPage, freeOnly }) {
      const pool = Array.from({ length: perPage * 4 }, (_, i) => fakeItem(id, source, query, i))
      const wanted = pool.filter(
        (item) => !freeOnly || ['cc0', 'pdm', 'by', 'by-sa'].includes(item.licence.code)
      )
      return { items: wanted.slice((page - 1) * perPage, page * perPage), hasMore: page < 2 }
    }
  })
  return [
    make('openverse', 'Openverse', 'Flickr'),
    make('commons', 'Wikimedia Commons', 'Wikimedia Commons')
  ]
}

const hashOf = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** A small PNG whose colour depends on `seed`, so different results look different. */
export function fakePng(seed: string, width = 96, height = 72): Uint8Array {
  const h = hashOf(seed)
  const [r, g, b] = [(h >> 16) & 255, (h >> 8) & 255, h & 255]
  const pixels = new Uint8Array(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3
      const edge = x < 4 || y < 4 || x >= width - 4 || y >= height - 4
      pixels[o] = edge ? 40 : r
      pixels[o + 1] = edge ? 40 : g
      pixels[o + 2] = edge ? 40 : b
    }
  }
  return encodePng(pixels, width, height, 'rgb')
}

/** A 200 response carrying a PNG. */
export const pngResponse = (bytes: Uint8Array): Response =>
  new Response(bytes as unknown as ConstructorParameters<typeof Response>[0], {
    status: 200,
    headers: { 'content-type': 'image/png', 'content-length': String(bytes.byteLength) }
  })

/** `fetch` for the fake providers' addresses; anything else is refused like a network failure. */
export const fakeFetch: FetchFn = async (url) => {
  const parsed = new URL(url)
  if (parsed.hostname !== FAKE_HOST) throw new TypeError('fetch failed')
  return pngResponse(fakePng(parsed.pathname))
}
