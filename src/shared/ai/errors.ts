/**
 * The friendly copy for every AI failure (design/ai-pipeline.md §9, design/screens/README.md "Shared AI error copy").
 * Pure: shared by the main process (which builds Failures) and the UI (which may re-derive text from a code).
 */
import { fail, type AiErrorCode, type Failure } from '../result'
import { MODEL_LABELS, isModelChoice } from './prices'

export const NOT_CONNECTED = 'Claude isn’t connected. Add your API key to keep going.'
export const BUSY = 'Claude is busy right now. Try again in a minute.'
export const STOPPED = 'Stopped. Nothing was changed.'
export const INVALID_OPS = 'I couldn’t make that change cleanly. Nothing was changed.'

const modelName = (model?: string): string =>
  model && isModelChoice(model) ? MODEL_LABELS[model] : (model ?? 'this model')

/** The message shown for an AI error code. `model` fills the {model name} slot. */
export function aiErrorMessage(code: AiErrorCode, model?: string): string {
  switch (code) {
    case 'no-key':
    case 'invalid-key':
      return NOT_CONNECTED
    case 'no-credit':
      return 'Your Claude account is out of credit.'
    case 'rate-limited':
    case 'overloaded':
      return BUSY
    case 'network':
      return 'Can’t reach Claude. Check your internet connection.'
    case 'refused':
      return 'Claude couldn’t help with that request.'
    case 'model-unavailable':
    case 'permission':
      return `Your API key can’t use ${modelName(model)}. Pick another model in Settings.`
    case 'too-large':
      return 'That file is too big to send to Claude.'
    case 'unknown':
      return 'Something went wrong talking to Claude.'
  }
}

/** A Failure carrying the friendly message for `code`. */
export function aiFailure(
  code: AiErrorCode,
  extra?: { model?: string; retryAfterSeconds?: number }
): Failure {
  return fail(code, aiErrorMessage(code, extra?.model), {
    ...(extra?.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: extra.retryAfterSeconds })
  })
}

/** The "Stopped." failure for a cancelled call. */
export const cancelledFailure = (): Failure => fail('cancelled', STOPPED)

/** True for codes that a "Try again" button can sensibly retry. */
export const isRetryable = (code: Failure['code']): boolean =>
  code === 'rate-limited' || code === 'overloaded' || code === 'network' || code === 'unknown'
