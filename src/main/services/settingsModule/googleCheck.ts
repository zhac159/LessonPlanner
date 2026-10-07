/**
 * The FREE check of a Google AI Studio key (A7 "Test picture maker"): it lists the models the key can see
 * (`GET /v1beta/models`, key in the `x-goog-api-key` header) and looks for the chosen picture model. No picture is
 * made and nothing is billed. What it cannot see is billing: the image models have no free tier, and Google only
 * says "no credit" when a picture is generated, so a key that passes here can still fail later (the UI says so).
 *
 * The key is only ever put in a header; nothing returned or thrown here contains it.
 */
import { fail, ok, type Failure, type Result } from '@shared/result'
import { GEMINI_BASE_URL, mapGeminiHttpError } from '../imageProviders/nanoBanana'
import type { FetchFn } from '../imageProviders/types'

const MAX_PAGES = 5
const TIMEOUT_MS = 15_000

/**
 * Google AI Studio keys come in two shapes: the classic `AIza…` (39 characters) and the newer "auth keys" that AI
 * Studio has created since 2026-05-28, which look like `AQ.Ab8…` (53 characters; seen live). A shape check only.
 */
export const looksLikeGoogleApiKey = (key: string): boolean =>
  /^(AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z_-]{16,200})$/.test(key.replace(/\s+/g, ''))

const GOOGLE_KEY_LIKE = /(?:AIza|AQ\.)[0-9A-Za-z_-]{6,}/g

/** Hides anything that looks like (or is) a Google key, so text is safe to show or log. */
export function redactGoogleKeys(text: string, key?: string): string {
  const plain = key ? text.split(key).join('AIza…') : text
  return plain.replace(GOOGLE_KEY_LIKE, 'AIza…')
}

export const MODEL_NOT_ON_KEY = 'That picture maker isn’t available on this key.'
export const CANNOT_REACH_GOOGLE = 'Couldn’t reach Google. Check your internet.'

interface ModelPage {
  names: string[]
  next: string
}

function readPage(text: string): ModelPage | null {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof json !== 'object' || json === null) return null
  const record = json as { models?: unknown; nextPageToken?: unknown }
  const models = Array.isArray(record.models) ? record.models : []
  const names = models.flatMap((m) =>
    typeof m === 'object' && m !== null && typeof (m as { name?: unknown }).name === 'string'
      ? [(m as { name: string }).name.replace(/^models\//, '')]
      : []
  )
  return { names, next: typeof record.nextPageToken === 'string' ? record.nextPageToken : '' }
}

export interface GoogleCheckOptions {
  key: string
  /** The picture model that must be offered to this key. */
  model: string
  fetchFn: FetchFn
  baseUrl?: string
}

/** One free request (a few pages at most). Failures are typed (`mapGeminiHttpError`) with messages that never hold the key. */
export async function checkGoogleKey(
  options: GoogleCheckOptions
): Promise<Result<{ model: string }>> {
  const { key, model, fetchFn, baseUrl = GEMINI_BASE_URL } = options
  const clean = (failure: Failure): Failure => ({
    ...failure,
    message: redactGoogleKeys(failure.message, key)
  })
  let token = ''
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = `pageSize=1000${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`
    let text: string
    try {
      const res = await fetchFn(`${baseUrl}/v1beta/models?${query}`, {
        headers: { 'x-goog-api-key': key },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
      text = await res.text()
      if (!res.ok) return clean(mapGeminiHttpError(res.status, text))
    } catch {
      return fail('network', CANNOT_REACH_GOOGLE)
    }
    const parsed = readPage(text)
    if (!parsed) return fail('unknown', 'Google sent a reply the app could not read.')
    if (parsed.names.includes(model)) return ok({ model })
    if (!parsed.next) break
    token = parsed.next
  }
  return fail('model-unavailable', MODEL_NOT_ON_KEY)
}

/** A fetch that answers the list-models call without the network (fake-AI runs and e2e). */
export const fakeGoogleFetch: FetchFn = async () =>
  new Response(
    JSON.stringify({
      models: [{ name: 'models/gemini-3-pro-image' }, { name: 'models/gemini-nano-banana-2.1' }]
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
