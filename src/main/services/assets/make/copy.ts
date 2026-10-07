/** Friendly wording and error mapping for the make-new service (British English, no jargon, never a key). */
import type { AiErrorCode, Failure } from '@shared/result'
import type { MakeProgress } from '@shared/contracts/assets'
import { redactGoogleKeys } from '../../settingsModule/googleCheck'

export const NEED_A_REQUEST = 'Describe the picture you want.'
export const PHOTO_NEEDS_MAKER =
  'Photo-like pictures need the picture maker. Add one in Settings › AI, or try Find online.'
export const NOTHING_CONNECTED =
  'Connect Claude or a picture maker in Settings › AI to make pictures.'
export const GONE = 'That picture is not available any more. Make it again.'
export const STILL_DRAWING = 'Still making the pictures. Try again in a moment.'
export const NOT_FAILED = 'That version already worked.'
export const FAILED_VERSION = 'Didn’t work'

const AI_CODES: readonly string[] = [
  'no-key',
  'invalid-key',
  'no-credit',
  'permission',
  'model-unavailable',
  'rate-limited',
  'overloaded',
  'network',
  'too-large',
  'refused',
  'unknown'
]
const RETRY: readonly string[] = ['rate-limited', 'overloaded', 'network', 'unknown', 'refused']
/** Failures that will not change on the next version, so the rest of the job stops (and nothing more is billed). */
export const STOPS_JOB: readonly string[] = [
  'no-key',
  'invalid-key',
  'no-credit',
  'permission',
  'model-unavailable',
  'invalid-input'
]

/** The error the sheet shows: Google's and Claude's messages are already plain; keys are scrubbed anyway. */
export function errorOf(failure: Failure): NonNullable<MakeProgress['error']> {
  return {
    code: AI_CODES.includes(failure.code) ? (failure.code as AiErrorCode) : 'picture-maker',
    message: redactGoogleKeys(failure.message),
    retryable: RETRY.includes(failure.code)
  }
}
