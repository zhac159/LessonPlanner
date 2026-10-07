/**
 * Safe download of a picture chosen online. The URL came from a third-party API, so: https only, no local or
 * private addresses, a few manual redirects (each hop checked again), a size cap (10 MB, also while streaming), a
 * deadline plus the caller's abort signal, and the type is decided by the bytes, never by the server's label.
 * SVG is refused unless `allowSvg` is set, and then only when `sanitiseSvg` (src/shared/deck/svg.ts) accepts it; the
 * file is passed on as it came and every rendering goes through the sanitiser.
 */
import { LIBRARY_SVG, sanitiseSvg } from '@shared/deck/svg'
import { ImageProviderError } from './errors'
import { linkSignals } from './http'
import { DEFAULT_USER_AGENT, type FetchFn } from './types'

export const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024

export type DownloadMime = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | 'image/svg+xml'

export interface DownloadedImage {
  bytes: Uint8Array
  mime: DownloadMime
  /** File extension without the dot. */
  extension: 'png' | 'jpg' | 'gif' | 'webp' | 'svg'
  /** The URL after redirects. */
  finalUrl: string
}

export interface DownloadOptions {
  fetchFn: FetchFn
  userAgent?: string
  maxBytes?: number
  maxRedirects?: number
  timeoutMs?: number
  signal?: AbortSignal
  allowSvg?: boolean
}

const EXTENSIONS: Record<DownloadMime, DownloadedImage['extension']> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
}

/** Decide the image type from its first bytes; null when it is not a supported picture. */
export function sniffImage(bytes: Uint8Array): DownloadMime | null {
  const at = (i: number): number => bytes[i] ?? -1
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'image/png'
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg'
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) return 'image/gif'
  if (
    at(0) === 0x52 &&
    at(1) === 0x49 &&
    at(2) === 0x46 &&
    at(3) === 0x46 &&
    at(8) === 0x57 &&
    at(9) === 0x45 &&
    at(10) === 0x42 &&
    at(11) === 0x50
  ) {
    return 'image/webp'
  }
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).replace(/^﻿/, '').trimStart()
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head)) return 'image/svg+xml'
  return null
}

const PRIVATE_HOST =
  /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[.*\])/i

/** Throws unless `url` is a public https URL. */
export function assertSafeUrl(url: string): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new ImageProviderError('invalid-input', 'That picture address is not valid.')
  }
  if (
    parsed.protocol !== 'https:' ||
    PRIVATE_HOST.test(parsed.hostname) ||
    parsed.username ||
    parsed.password
  ) {
    throw new ImageProviderError('invalid-input', 'That picture address is not allowed.')
  }
  return parsed
}

const tooLarge = (max: number): ImageProviderError =>
  new ImageProviderError(
    'too-large',
    `That picture is larger than ${Math.round(max / 1024 / 1024)} MB.`
  )

async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > max) throw tooLarge(max)
  if (!res.body) {
    const all = new Uint8Array(await res.arrayBuffer())
    if (all.byteLength > max) throw tooLarge(max)
    return all
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      void reader.cancel().catch(() => undefined)
      throw tooLarge(max)
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

export async function downloadImage(
  url: string,
  options: DownloadOptions
): Promise<DownloadedImage> {
  const {
    fetchFn,
    userAgent = DEFAULT_USER_AGENT,
    maxBytes = MAX_DOWNLOAD_BYTES,
    maxRedirects = 3,
    timeoutMs = 30_000,
    signal,
    allowSvg = false
  } = options
  const link = linkSignals(signal, timeoutMs)
  try {
    let current = assertSafeUrl(url).toString()
    for (let hop = 0; ; hop++) {
      let res: Response
      try {
        res = await fetchFn(current, {
          redirect: 'manual',
          signal: link.signal,
          headers: { 'user-agent': userAgent, accept: 'image/*,*/*;q=0.8' }
        })
      } catch {
        if (signal?.aborted) throw new ImageProviderError('cancelled', 'Cancelled.')
        throw new ImageProviderError(
          'network',
          link.timedOut()
            ? 'The picture took too long to download.'
            : 'Could not download the picture.'
        )
      }
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        void res.body?.cancel().catch(() => undefined)
        if (!location)
          throw new ImageProviderError('unknown', 'The picture address redirected nowhere.')
        if (hop >= maxRedirects)
          throw new ImageProviderError('network', 'The picture address redirected too often.')
        current = assertSafeUrl(new URL(location, current).toString()).toString()
        continue
      }
      if (res.status === 404 || res.status === 410) {
        throw new ImageProviderError('not-found', 'That picture is no longer there.')
      }
      if (res.status === 429) {
        throw new ImageProviderError('rate-limited', 'The picture site asked the app to slow down.')
      }
      if (!res.ok)
        throw new ImageProviderError('network', `The picture site answered HTTP ${res.status}.`)
      let bytes: Uint8Array
      try {
        bytes = await readCapped(res, maxBytes)
      } catch (error) {
        if (error instanceof ImageProviderError) throw error
        if (signal?.aborted) throw new ImageProviderError('cancelled', 'Cancelled.')
        throw new ImageProviderError('network', 'The picture download was cut off.')
      }
      const mime = sniffImage(bytes)
      if (!mime)
        throw new ImageProviderError('invalid-input', 'That file is not a picture the app can use.')
      if (mime === 'image/svg+xml') {
        if (!allowSvg)
          throw new ImageProviderError(
            'invalid-input',
            'Vector (SVG) pictures are not accepted here.'
          )
        // Only checked here: the library keeps the file as it came and draws a cleaned copy.
        const clean = sanitiseSvg(new TextDecoder().decode(bytes), LIBRARY_SVG)
        if (!clean.ok)
          throw new ImageProviderError(
            'invalid-input',
            `That vector picture was refused: ${clean.error}.`
          )
      }
      return { bytes, mime, extension: EXTENSIONS[mime], finalUrl: current }
    }
  } finally {
    link.dispose()
  }
}
