import { ImageProviderError } from './errors'
import type { FetchFn } from './types'

/** Lenient readers for third-party JSON: a missing or odd field never throws, it just reads as "absent". */
export type Rec = Record<string, unknown>
export const asRec = (value: unknown): Rec =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {}
export const asArr = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
export const str = (value: unknown): string => (typeof value === 'string' ? value : '')
export const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

export interface LinkedSignal {
  signal: AbortSignal
  /** True when the deadline (not the caller) aborted. */
  timedOut: () => boolean
  dispose: () => void
}

/** One signal that fires when the caller aborts or the deadline passes. */
export function linkSignals(external: AbortSignal | undefined, timeoutMs: number): LinkedSignal {
  const controller = new AbortController()
  let timedOut = false
  const onAbort = (): void => controller.abort(external?.reason)
  if (external?.aborted) controller.abort(external.reason)
  else external?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort(new Error('timeout'))
  }, timeoutMs)
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer)
      external?.removeEventListener('abort', onAbort)
    }
  }
}

export interface RequestOptions {
  headers?: Record<string, string>
  method?: 'GET' | 'POST'
  body?: string
  signal?: AbortSignal
  timeoutMs?: number
  /** The service uses a key the teacher gave: 401/403 mean a bad key, not a blocked app. */
  keyed?: boolean
  /** Name for messages ("Openverse"). */
  service: string
}

/** Seconds to wait, from a `Retry-After` header or a "Expected available in N seconds" message. */
export function retryAfterOf(res: Response, text: string): number | undefined {
  const header = Number(res.headers.get('retry-after'))
  if (Number.isFinite(header) && header > 0) return Math.ceil(header)
  const m = /available in (\d+) second/i.exec(text)
  return m ? Number(m[1]) : undefined
}

/** Map an HTTP failure of a search service to a typed error. */
export function httpError(res: Response, text: string, opts: RequestOptions): ImageProviderError {
  const { service, keyed } = opts
  const s = res.status
  if (s === 429) {
    const wait = retryAfterOf(res, text)
    return new ImageProviderError(
      'rate-limited',
      `${service} says too many searches were made. Try again ${wait ? `in about ${wait} seconds` : 'in a little while'}.`,
      wait
    )
  }
  if (s === 401 || s === 403) {
    return new ImageProviderError(
      keyed ? 'invalid-key' : 'permission',
      keyed ? `${service} did not accept the key.` : `${service} refused the request.`
    )
  }
  if (s === 404) return new ImageProviderError('not-found', `${service} could not find that.`)
  if (s === 400 || s === 422) {
    return new ImageProviderError('invalid-input', `${service} did not understand the search.`)
  }
  if (s === 503 || s === 502 || s === 504) {
    return new ImageProviderError('overloaded', `${service} is busy right now. Try again soon.`)
  }
  return new ImageProviderError('unknown', `${service} had a problem (HTTP ${s}).`)
}

/** GET (or POST) JSON with a deadline, a caller signal and typed failures. Never leaks a raw fetch error. */
export async function requestJson(
  fetchFn: FetchFn,
  url: string,
  opts: RequestOptions
): Promise<{ data: unknown; headers: Headers }> {
  const link = linkSignals(opts.signal, opts.timeoutMs ?? 15_000)
  try {
    let res: Response
    try {
      res = await fetchFn(url, {
        method: opts.method ?? 'GET',
        headers: { accept: 'application/json', ...opts.headers },
        body: opts.body,
        signal: link.signal
      })
    } catch (error) {
      if (opts.signal?.aborted) throw new ImageProviderError('cancelled', 'Cancelled.')
      if (link.timedOut())
        throw new ImageProviderError('network', `${opts.service} took too long to answer.`)
      void error
      throw new ImageProviderError(
        'network',
        `Could not reach ${opts.service}. Check the internet connection.`
      )
    }
    let text: string
    try {
      text = await res.text()
    } catch {
      if (opts.signal?.aborted) throw new ImageProviderError('cancelled', 'Cancelled.')
      throw new ImageProviderError('network', `The reply from ${opts.service} was cut off.`)
    }
    if (!res.ok) throw httpError(res, text, opts)
    try {
      return { data: JSON.parse(text) as unknown, headers: res.headers }
    } catch {
      throw new ImageProviderError(
        'unknown',
        `${opts.service} sent a reply the app could not read.`
      )
    }
  } finally {
    link.dispose()
  }
}
