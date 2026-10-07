/**
 * "Nano Banana Pro" (Gemini 3 Pro Image) through the Gemini API `generateContent` method, against an injected
 * `fetch`. Format verified against ai.google.dev on 2026-10-07 (agents/assets/PROVIDERS.md). Needs the teacher's
 * Google AI Studio key on a PAID project (the image models have no free tier). The key travels only in the
 * `x-goog-api-key` header and never appears in a message.
 */
import { fail, ok, type ErrorCode, type Failure, type Result } from '@shared/result'
import { isAbort } from './errors'
import { asArr, asRec, linkSignals, str } from './http'
import { sniffImage } from './download'
import type { FetchFn } from './types'

export const NANO_BANANA_PRO_MODEL = 'gemini-3-pro-image'
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com'

export type PictureAspect =
  '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3' | '5:4' | '4:5' | '21:9'
export type PictureSize = '1K' | '2K' | '4K'

export interface MakeImagesRequest {
  prompt: string
  /** Pictures that show the look to match (PNG, JPEG or WebP bytes). Extra ones beyond the maker's limit are dropped. */
  references?: Uint8Array[]
  /** How many versions (1 to 4). One request each: the API returns one picture per call. */
  count: number
  aspect: PictureAspect
  /** Default 2K (the same price as 1K for the Pro model). */
  size?: PictureSize
  signal?: AbortSignal
}

export interface MadeImage {
  bytes: Uint8Array
  mime: 'image/png' | 'image/jpeg' | 'image/webp'
}

export type MakeImagesResult = Result<{ images: MadeImage[]; failed: number }>

export interface PictureMaker {
  readonly id: string
  readonly model: string
  /** Returns at least one picture or a typed failure. `failed` counts versions that did not arrive. */
  makeImages(request: MakeImagesRequest): Promise<MakeImagesResult>
}

export interface NanoBananaOptions {
  /** Read on every call; the key stays in main. */
  getKey: () => string | undefined | Promise<string | undefined>
  fetchFn: FetchFn
  model?: string
  baseUrl?: string
  timeoutMs?: number
  /** Reference pictures sent at most (Pro blends up to 6 objects + 5 characters; 6 keeps requests small). */
  maxReferences?: number
  /** Requests in flight at once when several versions are asked for. */
  concurrency?: number
}

/** List prices in USD per picture (ai.google.dev/gemini-api/docs/pricing, 2026-10-07, paid tier, standard). */
export const PICTURE_PRICES_USD: Record<string, Record<PictureSize, number>> = {
  'gemini-3-pro-image': { '1K': 0.134, '2K': 0.134, '4K': 0.24 },
  'gemini-nano-banana-2.1': { '1K': 0.0336, '2K': 0.0504, '4K': 0.113 },
  'gemini-3.1-flash-lite-image': { '1K': 0.0336, '2K': 0.0336, '4K': 0.0336 }
}

export function estimatePictureCost(
  model: string,
  size: PictureSize,
  count: number
): number | null {
  const price = PICTURE_PRICES_USD[model]?.[size]
  return price === undefined ? null : Math.round(price * count * 10_000) / 10_000
}

const SAFETY_REASONS = new Set([
  'SAFETY',
  'IMAGE_SAFETY',
  'PROHIBITED_CONTENT',
  'IMAGE_PROHIBITED_CONTENT',
  'IMAGE_RECITATION',
  'RECITATION',
  'BLOCKLIST',
  'SPII',
  'IMAGE_OTHER',
  'NO_IMAGE',
  'OTHER',
  'PUP_LIMITED_DISABLED'
])

/** The error body is `{error:{code,status,message,details:[{reason,retryDelay}]}}` (an array of one on some paths). */
function readError(text: string): {
  message: string
  status: string
  reason: string
  retry?: number
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { message: '', status: '', reason: '' }
  }
  const root = asRec(Array.isArray(parsed) ? parsed[0] : parsed)
  const error = asRec(root.error)
  let reason = ''
  let retry: number | undefined
  for (const d of asArr(error.details).map(asRec)) {
    if (str(d.reason)) reason = str(d.reason)
    const delay = /^(\d+(?:\.\d+)?)s$/.exec(str(d.retryDelay))
    if (delay) retry = Math.ceil(Number(delay[1]))
  }
  return { message: str(error.message), status: str(error.status), reason, retry }
}

/** Map a Gemini HTTP failure to a typed failure. Pure, so it is tested with recorded error bodies. */
export function mapGeminiHttpError(httpStatus: number, text: string): Failure {
  const e = readError(text)
  const msg = e.message.toLowerCase()
  const bad = (code: ErrorCode, message: string, retry?: number): Failure =>
    fail(code, message, retry === undefined ? undefined : { retryAfterSeconds: retry })
  if (e.reason === 'API_KEY_INVALID' || /api key (not valid|expired)|api_key_invalid/.test(msg)) {
    return bad(
      'invalid-key',
      'Google did not accept this key. Copy it again from Google AI Studio.'
    )
  }
  if (httpStatus === 401 || /unregistered callers/.test(msg)) {
    return bad(
      'invalid-key',
      'Google did not accept this key. Copy it again from Google AI Studio.'
    )
  }
  const billingStatus = [400, 402, 403, 429].includes(httpStatus)
  if (
    httpStatus === 402 ||
    (billingStatus && /prepay|billing|credit/.test(msg)) ||
    (httpStatus === 400 && e.status === 'FAILED_PRECONDITION' && !/location/.test(msg))
  ) {
    return bad(
      'no-credit',
      'The Google account has no billing set up or no credit left. Picture making is a paid Google service.'
    )
  }
  if (httpStatus === 429) {
    if (/limit:\s*0|free.?tier|quota exceeded for metric.*free/.test(msg) || /billing/.test(msg)) {
      return bad(
        'no-credit',
        'This Google key is on the free plan, which cannot make pictures. Add billing in Google AI Studio.'
      )
    }
    if (e.reason === 'QUOTA_EXCEEDED' || /daily/.test(msg)) {
      return bad('no-credit', 'The daily picture quota of this Google key is used up.', e.retry)
    }
    return bad(
      'rate-limited',
      'Google asks the app to slow down. Try again in a moment.',
      e.retry ?? 30
    )
  }
  if (httpStatus === 403) {
    return bad(
      'permission',
      'This Google key is not allowed to make pictures (or not in your country yet).'
    )
  }
  if (httpStatus === 400 && /location/.test(msg)) {
    return bad('permission', 'Google does not offer picture making in your location.')
  }
  if (httpStatus === 404)
    return bad(
      'model-unavailable',
      'Google no longer offers this picture model. The app needs an update.'
    )
  if (httpStatus === 413) return bad('too-large', 'The pictures sent as examples are too large.')
  if (httpStatus === 400)
    return bad(
      'invalid-input',
      'Google could not use that request. Try a shorter description or fewer examples.'
    )
  if (httpStatus === 500 || httpStatus === 502 || httpStatus === 503 || httpStatus === 504) {
    return bad('overloaded', 'Google is busy right now. Try again in a minute.')
  }
  return bad('unknown', `Google had a problem (HTTP ${httpStatus}).`)
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64')
}

export function buildRequestBody(
  request: Pick<MakeImagesRequest, 'prompt' | 'aspect'> & {
    size: PictureSize
    references: Uint8Array[]
  }
): object {
  const parts: object[] = [{ text: request.prompt }]
  for (const bytes of request.references) {
    parts.push({ inlineData: { mimeType: sniffImage(bytes), data: toBase64(bytes) } })
  }
  return {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: request.aspect, imageSize: request.size }
    }
  }
}

/** Pull the final picture out of a 200 response, or say why there is none. */
export function readImage(body: unknown): { image: MadeImage } | { failure: Failure } {
  const root = asRec(body)
  const blockReason = str(asRec(root.promptFeedback).blockReason)
  const candidate = asRec(asArr(root.candidates)[0])
  const finish = str(candidate.finishReason)
  let image: MadeImage | undefined
  let text = ''
  for (const raw of asArr(asRec(candidate.content).parts)) {
    const part = asRec(raw)
    if (part.thought === true) continue
    const inline = asRec(part.inlineData ?? part.inline_data)
    const data = str(inline.data)
    if (data) {
      const bytes = new Uint8Array(Buffer.from(data, 'base64'))
      const mime = sniffImage(bytes)
      if (mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp')
        image = { bytes, mime }
    } else if (str(part.text)) text += str(part.text)
  }
  if (image) return { image }
  if (blockReason || SAFETY_REASONS.has(finish)) {
    return {
      failure: fail(
        'refused',
        "Google's safety filter would not make that picture. Try describing it differently."
      )
    }
  }
  const said = text.trim().slice(0, 160)
  return {
    failure: fail(
      'refused',
      said
        ? `Google did not make a picture: ${said}`
        : 'Google did not return a picture. Try again.'
    )
  }
}

export function createNanoBananaMaker(options: NanoBananaOptions): PictureMaker {
  const {
    getKey,
    fetchFn,
    model = NANO_BANANA_PRO_MODEL,
    baseUrl = GEMINI_BASE_URL,
    timeoutMs = 180_000,
    maxReferences = 6,
    concurrency = 2
  } = options

  async function one(
    key: string,
    body: string,
    signal: AbortSignal | undefined
  ): Promise<Result<{ image: MadeImage }>> {
    const link = linkSignals(signal, timeoutMs)
    try {
      let res: Response
      try {
        res = await fetchFn(
          `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
            body,
            signal: link.signal
          }
        )
      } catch (error) {
        if (signal?.aborted || (isAbort(error) && !link.timedOut()))
          return fail('cancelled', 'Cancelled.')
        return fail(
          'network',
          link.timedOut()
            ? 'Google took too long to make the picture.'
            : 'Could not reach Google. Check the internet connection.'
        )
      }
      let text: string
      try {
        text = await res.text()
      } catch {
        return signal?.aborted
          ? fail('cancelled', 'Cancelled.')
          : fail('network', 'The reply from Google was cut off.')
      }
      if (!res.ok) return mapGeminiHttpError(res.status, text)
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        return fail('unknown', 'Google sent a reply the app could not read.')
      }
      const read = readImage(json)
      return 'failure' in read ? read.failure : ok({ image: read.image })
    } finally {
      link.dispose()
    }
  }

  return {
    id: 'nano-banana',
    model,
    async makeImages(request) {
      const prompt = request.prompt.trim()
      if (!prompt) return fail('invalid-input', 'Describe the picture you want.')
      const count = Math.min(4, Math.max(1, Math.floor(request.count) || 1))
      const key = (await getKey())?.trim()
      if (!key) return fail('no-key', 'Add a Google picture-maker key in Settings first.')
      const references = (request.references ?? [])
        .filter(
          (b) => sniffImage(b) && sniffImage(b) !== 'image/gif' && sniffImage(b) !== 'image/svg+xml'
        )
        .slice(0, maxReferences)
      const body = JSON.stringify(
        buildRequestBody({ prompt, aspect: request.aspect, size: request.size ?? '2K', references })
      )
      const results: Array<Result<{ image: MadeImage }>> = new Array(count)
      let next = 0
      const worker = async (): Promise<void> => {
        while (next < count && !request.signal?.aborted) {
          const index = next++
          results[index] = await one(key, body, request.signal)
          // A bad key, no credit or a safety block will not change on the next version: stop early.
          const r = results[index]
          if (
            !r.ok &&
            [
              'invalid-key',
              'no-credit',
              'permission',
              'model-unavailable',
              'refused',
              'invalid-input'
            ].includes(r.code)
          ) {
            next = count
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker))
      const images: MadeImage[] = []
      let firstFailure: Failure | undefined
      let failed = 0
      for (const r of results) {
        if (!r) continue
        if (r.ok) images.push(r.image)
        else {
          failed++
          firstFailure ??= r
        }
      }
      if (images.length) return ok({ images, failed: count - images.length })
      return firstFailure ?? fail('cancelled', 'Cancelled.')
    }
  }
}
