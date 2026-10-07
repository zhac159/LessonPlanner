/**
 * Results across IPC. The bridge only carries an error *message*, so handlers whose failures the UI
 * must tell apart RETURN a Result instead of throwing (design/screens/README.md "Results and errors").
 * Pure TypeScript: no Node, Electron or DOM imports.
 */

export type AiErrorCode =
  | 'no-key'
  | 'invalid-key'
  | 'no-credit'
  | 'permission'
  | 'model-unavailable'
  | 'rate-limited'
  | 'overloaded'
  | 'network'
  | 'too-large'
  | 'refused'
  | 'unknown'

export type ErrorCode = AiErrorCode | 'not-found' | 'invalid-input' | 'io' | 'file-locked' | 'cancelled'

export interface Failure {
  ok: false
  code: ErrorCode
  message: string
  retryAfterSeconds?: number
}

export type Success<T extends object = object> = { ok: true } & T

/** `Result<{ lesson: Lesson }>` = `{ ok: true; lesson } | { ok: false; code; message }` */
export type Result<T extends object = object> = Success<T> | Failure

export const ok = <T extends object = object>(value?: T): Success<T> =>
  ({ ok: true, ...(value ?? {}) }) as Success<T>

export const fail = (code: ErrorCode, message: string, extra?: { retryAfterSeconds?: number }): Failure => ({
  ok: false,
  code,
  message,
  ...extra
})

export const isFailure = (result: Result<object>): result is Failure => !result.ok
