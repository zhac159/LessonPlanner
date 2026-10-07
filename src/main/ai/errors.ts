/**
 * Maps SDK failures to the app's `Failure`s (design/ai-pipeline.md §9) and retries the transient ones.
 * Mapping uses the SDK's typed error classes and HTTP status, never message matching, with ONE exception the
 * API forces on us: a 400 whose message says the credit balance is too low (there is no separate status).
 */
import Anthropic, { type APIError } from '@anthropic-ai/sdk'
import { aiFailure, cancelledFailure } from '@shared/ai/errors'
import { redactApiKeys } from '@shared/ai/keyFormat'
import { ok, type AiErrorCode, type Failure, type Result } from '@shared/result'

import { AiCallError, aiError } from './aiError'

export { AiCallError, aiError }

const isAbort = (error: unknown): boolean =>
  error instanceof Anthropic.APIUserAbortError ||
  (error instanceof Error && error.name === 'AbortError') ||
  (error instanceof DOMException && error.name === 'AbortError')

function retryAfterSeconds(error: APIError): number | undefined {
  const raw = error.headers?.get?.('retry-after')
  const seconds = raw === null || raw === undefined ? NaN : Number(raw)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
}

function mapStatusError(error: APIError, model?: string): Failure {
  if (error instanceof Anthropic.AuthenticationError) return aiFailure('invalid-key', { model })
  if (error instanceof Anthropic.PermissionDeniedError) return aiFailure('permission', { model })
  if (error instanceof Anthropic.NotFoundError) return aiFailure('model-unavailable', { model })
  if (error instanceof Anthropic.RateLimitError) {
    return aiFailure('rate-limited', { model, retryAfterSeconds: retryAfterSeconds(error) })
  }
  if (error instanceof Anthropic.BadRequestError) {
    return /credit balance is too low/i.test(error.message)
      ? aiFailure('no-credit', { model })
      : aiFailure('unknown', { model })
  }
  if (error.status === 413) return aiFailure('too-large', { model })
  if (error.status === 529 || error.status === 503) {
    return aiFailure('overloaded', { model, retryAfterSeconds: retryAfterSeconds(error) })
  }
  return aiFailure('unknown', { model })
}

/** Turns anything thrown by a Claude call into a `Failure`. Never includes API keys in its output. */
export function mapSdkError(error: unknown, ctx: { model?: string } = {}): Failure {
  if (error instanceof AiCallError) return error.failure
  if (isAbort(error)) return cancelledFailure()
  if (error instanceof Anthropic.APIConnectionError) return aiFailure('network', ctx)
  if (error instanceof Anthropic.APIError) return mapStatusError(error, ctx.model)
  // Not an SDK error (a bug or a parse failure): keep the detail in the log, show the friendly text.
  const detail = error instanceof Error ? error.message : String(error)
  console.error('[ai] unexpected error:', redactApiKeys(detail))
  return aiFailure('unknown', ctx)
}

/** Runs `task`; any throw becomes a `Failure` (so public methods can return `Result`s). */
export async function guarded<T extends object>(
  task: () => Promise<T>,
  ctx: { model?: string } = {}
): Promise<Result<T>> {
  try {
    return ok(await task())
  } catch (error) {
    return mapSdkError(error, ctx)
  }
}

/** How many times each transient failure is retried (after the first attempt). */
export const RETRIES: Partial<Record<AiErrorCode, number>> = {
  'rate-limited': 3,
  overloaded: 3,
  network: 1
}

const MAX_WAIT_MS = 30_000

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>

/** Real sleep that wakes early (rejecting with an abort) when the signal fires. */
export const abortableSleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Anthropic.APIUserAbortError())
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new Anthropic.APIUserAbortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })

/** Backoff 1 s, 2 s, 4 s...; never shorter than the server's `retry-after`, never longer than 30 s. */
export function backoffMs(attempt: number, failure: Failure): number {
  const exponential = 1000 * 2 ** attempt
  const hinted = (failure.retryAfterSeconds ?? 0) * 1000
  return Math.min(MAX_WAIT_MS, Math.max(exponential, hinted))
}

/**
 * Calls `attempt` and retries transient failures (rate limit / overloaded x3, network x1) with backoff.
 * Throws the last error when retries run out; the caller maps it.
 */
export async function withRetry<T>(
  attempt: () => Promise<T>,
  opts: { sleep?: Sleep; signal?: AbortSignal; model?: string } = {}
): Promise<T> {
  const sleep = opts.sleep ?? abortableSleep
  const used: Partial<Record<AiErrorCode, number>> = {}
  for (;;) {
    try {
      return await attempt()
    } catch (error) {
      const failure = mapSdkError(error, { model: opts.model })
      const code = failure.code as AiErrorCode
      const allowed = RETRIES[code] ?? 0
      const done = used[code] ?? 0
      if (done >= allowed || opts.signal?.aborted) throw error
      used[code] = done + 1
      await sleep(backoffMs(done, failure), opts.signal)
    }
  }
}
