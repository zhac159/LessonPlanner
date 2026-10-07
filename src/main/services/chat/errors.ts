/** Maps a failure to what the teacher sees: the single action button and the `ai:error` event (ai-pipeline.md §9). */
import { isRetryable } from '@shared/ai/errors'
import type { ChatItem } from '@shared/contracts/deck-builder-chat'
import type { AiErrorCode, ErrorCode, Failure } from '@shared/result'

const AI_CODES: ReadonlySet<ErrorCode> = new Set<AiErrorCode>([
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
])

/** The AI error code for an event; failures that are not Claude's (bad ops, disk) show as `unknown`. */
export const toAiErrorCode = (code: ErrorCode): AiErrorCode =>
  AI_CODES.has(code) ? (code as AiErrorCode) : 'unknown'

/** The one action offered under an error message; `finish` is for a stopped generation. */
export function errorAction(
  code: ErrorCode,
  scope: 'chat' | 'generation' | 'plugin'
): NonNullable<ChatItem['error']>['action'] | undefined {
  if (code === 'cancelled') return scope === 'generation' ? 'finish' : undefined
  if (
    code === 'no-key' ||
    code === 'invalid-key' ||
    code === 'permission' ||
    code === 'model-unavailable'
  )
    return 'settings'
  if (code === 'no-credit') return 'console'
  if (code === 'refused') return undefined
  if (scope === 'generation') return 'finish'
  return isRetryable(code) || code === 'invalid-input' || code === 'io' ? 'retry' : undefined
}

/** The `error` part of a stored message. */
export function errorOf(failure: Failure, scope: 'chat' | 'generation' | 'plugin') {
  const action = errorAction(failure.code, scope)
  return { code: failure.code, message: failure.message, ...(action ? { action } : {}) }
}
