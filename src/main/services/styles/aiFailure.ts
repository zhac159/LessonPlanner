/** Turning an AI failure into what a file row shows, and deciding whether it pauses the whole queue. */
import type { StyleFileErrorCode } from '@shared/contracts/style-library'
import type { AiErrorCode, ErrorCode, Failure } from '@shared/result'
import type { FileError } from './types'

/** Account problems affect every file, so the queue pauses instead of failing files one by one. */
const ACCOUNT_ERRORS: ReadonlySet<ErrorCode> = new Set([
  'no-key',
  'invalid-key',
  'no-credit',
  'permission'
])
const RETRYABLE: ReadonlySet<ErrorCode> = new Set([
  'network',
  'overloaded',
  'rate-limited',
  'model-unavailable',
  'unknown'
])

export const isAccountError = (code: ErrorCode): code is AiErrorCode => ACCOUNT_ERRORS.has(code)

/** The readable reason for a file that Claude could not read (04-create-style.md failed-file reasons). */
export function fileErrorFromFailure(failure: Failure): FileError {
  const code = failure.code as StyleFileErrorCode
  switch (failure.code) {
    case 'network':
      return { code, message: 'Couldn’t reach Claude', retryable: true }
    case 'overloaded':
    case 'rate-limited':
      return { code, message: 'Claude was busy', retryable: true }
    case 'too-large':
      return { code, message: 'Too big for Claude to read', retryable: false }
    default:
      return { code, message: failure.message, retryable: RETRYABLE.has(failure.code) }
  }
}
