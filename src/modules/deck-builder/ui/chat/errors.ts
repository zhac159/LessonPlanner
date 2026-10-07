/** What a failed AI job shows in the chat: the single action per error code (design/screens/README.md). */
import type { ChatEvents, ChatItem } from '@shared/contracts/deck-builder-chat'
import type { AiErrorCode, ErrorCode } from '@shared/result'

export type ErrorAction = NonNullable<NonNullable<ChatItem['error']>['action']>

/** The label of the one button under an error message. */
export const ERROR_ACTION_LABELS: Record<ErrorAction, string> = {
  retry: 'Try again',
  settings: 'Open Settings',
  console: 'Open platform.claude.com ↗',
  finish: 'Finish the rest'
}

const SETTINGS_CODES: ReadonlySet<AiErrorCode> = new Set([
  'no-key',
  'invalid-key',
  'permission',
  'model-unavailable'
])

/** The action offered for an `ai:error` event; refusals and oversize files get none. */
export function errorActionFor(event: ChatEvents['ai:error']): ErrorAction | undefined {
  if (SETTINGS_CODES.has(event.code)) return 'settings'
  if (event.code === 'no-credit') return 'console'
  if (event.code === 'refused' || event.code === 'too-large') return undefined
  if (event.scope === 'generation') return 'finish'
  return event.retryable ? 'retry' : undefined
}

/** The `error` part of a message built from an `ai:error` event. */
export function errorFromEvent(event: ChatEvents['ai:error']): NonNullable<ChatItem['error']> {
  const action = errorActionFor(event)
  return { code: event.code, message: event.message, ...(action ? { action } : {}) }
}

/** A stopped turn is a calm note, not an error box. */
export const isStopped = (error: ChatItem['error']): boolean => error?.code === 'cancelled'

/** The `error` part of a message for a call that failed before a job started (`chat:send`, `plugins:run`). */
export function errorFromFailure(failure: {
  code: ErrorCode
  message: string
}): NonNullable<ChatItem['error']> {
  const code = failure.code
  const action: ErrorAction | undefined =
    code === 'no-key' || code === 'invalid-key'
      ? 'settings'
      : code === 'no-credit'
        ? 'console'
        : undefined
  return { code, message: failure.message, ...(action ? { action } : {}) }
}
