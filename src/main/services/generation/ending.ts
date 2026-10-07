/** What the teacher reads when a generation stops early (design/ai-pipeline.md §9, 05 §7). Pure. */
import { STOPPED } from '@shared/ai/errors'
import type { ChatItem } from '@shared/contracts/deck-builder-chat'
import type { Failure } from '@shared/result'
import { errorOf } from '../chat/errors'

export interface Stopped {
  /** The sentence shown ("Stopped after 5 of 8 slides.", "5 of 8 slides made — Finish the rest?"). */
  message: string
  /** The error part of the stored message, with its single action. */
  error: NonNullable<ChatItem['error']>
}

/**
 * How a stopped or failed generation is told. `done` of `total` slides exist; "Finish the rest" is only offered
 * when a plan was kept (`hasPlan`), otherwise a failure offers Retry and a Stop offers nothing.
 */
export function describeStop(
  failure: Failure,
  done: number,
  total: number,
  hasPlan: boolean
): Stopped {
  const cancelled = failure.code === 'cancelled'
  const message = cancelled
    ? done > 0
      ? `Stopped after ${done} of ${total} slides.`
      : STOPPED
    : done > 0
      ? `${done} of ${total} slides made — Finish the rest?`
      : failure.message
  const shown = errorOf({ ...failure, message }, 'generation')
  const { action, ...plain } = shown
  const error =
    action === 'finish' && !hasPlan
      ? { ...plain, ...(cancelled ? {} : { action: 'retry' as const }) }
      : shown
  return { message, error }
}
