/** Test-only helpers for the provider layer: a recording fake `fetch`, tiny image bytes and recorded API bodies. */
import type { FetchFn } from './types'

export interface RecordedCall {
  url: string
  init: RequestInit
  headers: Record<string, string>
}

export type FakeHandler = (call: RecordedCall, index: number) => Response | Promise<Response>

/** A `fetch` that answers from `handler` and records every call (header names lower-cased). */
export function fakeFetch(handler: FakeHandler): { fetchFn: FetchFn; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const fetchFn: FetchFn = async (url, init = {}) => {
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries((init.headers ?? {}) as Record<string, string>)) {
      headers[k.toLowerCase()] = v
    }
    const call = { url, init, headers }
    calls.push(call)
    if (init.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    return handler(call, calls.length - 1)
  }
  return { fetchFn, calls }
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  })

export const text = (body: string, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(body, { status, headers })

export const bytesResponse = (
  bytes: Uint8Array,
  headers: Record<string, string> = {},
  status = 200
): Response =>
  new Response(bytes as unknown as ConstructorParameters<typeof Response>[0], { status, headers })

/** The first bytes of real files: enough for type sniffing. */
export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46])
export const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0])
export const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
export const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><circle cx="5" cy="5" r="4"/></svg>'
)

/** Recorded (trimmed) Openverse response, 2026-10-07, q="leaf in sunlight". */
export const OPENVERSE_BODY = {
  result_count: 240,
  page_count: 80,
  page_size: 3,
  page: 1,
  results: [
    {
      id: '288699a3-4094-473a-a77b-39b27596c4bf',
      title: 'Leaf In Sunlight',
      foreign_landing_url: 'https://www.flickr.com/photos/40041412@N06/3999881122',
      url: 'https://live.staticflickr.com/2489/3999881122_81171ccc49_b.jpg',
      creator: 'The Webhamster',
      creator_url: 'https://www.flickr.com/photos/40041412@N06',
      license: 'by-sa',
      license_version: '2.0',
      license_url: 'https://creativecommons.org/licenses/by-sa/2.0/',
      provider: 'flickr',
      source: 'flickr',
      filetype: null,
      width: 1024,
      height: 685,
      thumbnail: 'https://api.openverse.org/v1/images/288699a3-4094-473a-a77b-39b27596c4bf/thumb/'
    },
    {
      id: 'nc-1',
      title: 'Leaf (non-commercial)',
      foreign_landing_url: 'https://www.flickr.com/photos/1/2',
      url: 'https://live.staticflickr.com/1/2.jpg',
      creator: 'Someone',
      license: 'by-nc',
      license_version: '2.0',
      license_url: 'https://creativecommons.org/licenses/by-nc/2.0/',
      source: 'flickr',
      width: 800,
      height: 600,
      thumbnail: 'https://api.openverse.org/v1/images/nc-1/thumb/'
    },
    {
      id: 'zero-1',
      title: 'Oak leaf',
      foreign_landing_url: 'https://commons.wikimedia.org/wiki/File:Oak.jpg',
      url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Oak.jpg',
      creator: null,
      license: 'cc0',
      license_version: '1.0',
      license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      source: 'wikimedia',
      width: 2000,
      height: 1500,
      thumbnail: 'https://api.openverse.org/v1/images/zero-1/thumb/'
    },
    {
      id: 'svg-1',
      title: 'Leaf drawing',
      foreign_landing_url: 'https://example.org/leaf',
      url: 'https://example.org/leaf.svg',
      license: 'by',
      license_version: '4.0',
      source: 'flickr',
      width: 100,
      height: 100
    }
  ]
}

const commonsMeta = (over: Record<string, string>): Record<string, { value: string }> => {
  const base: Record<string, string> = {
    ObjectName: 'Cave Painting, Maligrad Island',
    LicenseShortName: 'CC BY-SA 4.0',
    License: 'cc-by-sa-4.0',
    LicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
    Artist:
      '<a href="//commons.wikimedia.org/w/index.php?title=User:Ardit" class="new">Ardit &amp; Alimemeti</a>',
    Credit: '<span class="int-own-work">Own work</span>',
    AttributionRequired: 'true',
    Copyrighted: 'True',
    ...over
  }
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, { value: v }]))
}

const commonsPage = (
  pageid: number,
  index: number,
  title: string,
  over: { meta?: Record<string, string>; mime?: string; size?: number; width?: number } = {}
): object => ({
  pageid,
  ns: 6,
  title,
  index,
  imagerepository: 'local',
  imageinfo: [
    {
      size: over.size ?? 5_886_366,
      width: over.width ?? 4896,
      height: 2760,
      thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/${title.slice(5)}/330px-${title.slice(5)}${over.mime === 'image/svg+xml' ? '.png' : ''}`,
      thumbwidth: 320,
      thumbheight: 180,
      url: `https://upload.wikimedia.org/wikipedia/commons/d/da/${title.slice(5)}`,
      descriptionurl: `https://commons.wikimedia.org/wiki/${title.replace(/ /g, '_')}`,
      extmetadata: commonsMeta(over.meta ?? {}),
      mime: over.mime ?? 'image/jpeg'
    }
  ]
})

/** Recorded (trimmed) Commons response; pages arrive in arbitrary order and carry `index`. */
export const COMMONS_BODY = {
  batchcomplete: true,
  continue: { gsroffset: 4, continue: 'gsroffset||' },
  query: {
    pages: [
      commonsPage(2, 2, 'File:Dorawaka cave.jpg', {
        meta: { ObjectName: '', Artist: 'Kasun Perera 18' },
        size: 21_767,
        width: 390
      }),
      commonsPage(1, 1, 'File:Cave Painting, Maligrad Island.jpg'),
      commonsPage(3, 3, 'File:Lascaux NC.jpg', {
        meta: { LicenseShortName: 'CC BY-NC 4.0', License: 'cc-by-nc-4.0' }
      }),
      commonsPage(4, 4, 'File:Old map.jpg', {
        meta: { LicenseShortName: 'Public domain', License: 'pd', AttributionRequired: 'false' }
      }),
      commonsPage(5, 5, 'File:Huge scan.jpg', { size: 20_000_000 }),
      commonsPage(6, 6, 'File:Water cycle.svg', { mime: 'image/svg+xml', size: 10_000 }),
      commonsPage(7, 7, 'File:Scan.tiff', { mime: 'image/tiff' }),
      commonsPage(8, 8, 'File:Odd licence.jpg', {
        meta: { LicenseShortName: 'GFDL', License: 'gfdl' }
      })
    ]
  }
}

export const PEXELS_BODY = {
  page: 1,
  per_page: 2,
  next_page: 'https://api.pexels.com/v1/search/?page=2&per_page=2&query=leaf',
  photos: [
    {
      id: 1181,
      width: 4000,
      height: 3000,
      url: 'https://www.pexels.com/photo/green-leaf-1181/',
      photographer: 'Jane Doe',
      photographer_url: 'https://www.pexels.com/@jane',
      alt: 'Green leaf in sunlight',
      src: {
        original: 'https://images.pexels.com/photos/1181/original.jpeg',
        large2x: 'https://images.pexels.com/photos/1181/large2x.jpeg',
        medium: 'https://images.pexels.com/photos/1181/medium.jpeg'
      }
    }
  ]
}

export const UNSPLASH_BODY = {
  total: 20,
  total_pages: 2,
  results: [
    {
      id: 'abc123',
      width: 5000,
      height: 3333,
      description: null,
      alt_description: 'a leaf with sun behind it',
      urls: {
        raw: 'https://images.unsplash.com/photo-1?ixid=x',
        regular: 'https://images.unsplash.com/photo-1?w=1080&ixid=x',
        small: 'https://images.unsplash.com/photo-1?w=400&ixid=x'
      },
      links: {
        html: 'https://unsplash.com/photos/abc123',
        download_location: 'https://api.unsplash.com/photos/abc123/download?ixid=x'
      },
      user: { name: 'Ana Lopez', links: { html: 'https://unsplash.com/@ana' } }
    }
  ]
}

/** A recorded Gemini 400 for a bad key (the real reply is HTTP 400, not 401). */
export const GEMINI_BAD_KEY = {
  error: {
    code: 400,
    message: 'API key not valid. Please pass a valid API key.',
    status: 'INVALID_ARGUMENT',
    details: [
      {
        '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
        reason: 'API_KEY_INVALID',
        domain: 'googleapis.com'
      }
    ]
  }
}

/** A handwritten successful `generateContent` reply with a thought image, text and the final picture. */
export function geminiImageReply(bytes: Uint8Array = PNG, extra: object[] = []): object {
  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [
            { text: 'Here is your picture.' },
            {
              thought: true,
              inlineData: { mimeType: 'image/png', data: Buffer.from(JPEG).toString('base64') }
            },
            { inlineData: { mimeType: 'image/png', data: Buffer.from(bytes).toString('base64') } },
            ...extra
          ]
        },
        finishReason: 'STOP'
      }
    ],
    usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 1120 }
  }
}
