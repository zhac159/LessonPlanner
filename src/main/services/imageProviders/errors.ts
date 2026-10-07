import { fail, ok, type ErrorCode, type Failure, type Result } from '@shared/result'

/** A provider failure with a code the UI can tell apart (`@shared/result` ErrorCode). */
export class ImageProviderError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly retryAfterSeconds?: number
  ) {
    super(message)
    this.name = 'ImageProviderError'
  }
}

export function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
}

export function toFailure(error: unknown): Failure {
  if (error instanceof ImageProviderError) {
    return fail(
      error.code,
      error.message,
      error.retryAfterSeconds === undefined
        ? undefined
        : { retryAfterSeconds: error.retryAfterSeconds }
    )
  }
  if (isAbort(error)) return fail('cancelled', 'Cancelled.')
  return fail('unknown', error instanceof Error ? error.message : 'Something went wrong.')
}

/** Run a provider call and return a `Result` (for IPC handlers that must not throw). */
export async function guard<T extends object>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await run())
  } catch (error) {
    return toFailure(error)
  }
}
