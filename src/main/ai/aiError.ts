/**
 * The error the AI layer throws to unwind to its public method. Separate from errors.ts (which imports the
 * Anthropic SDK) so code that only throws or recognises it does not load the SDK at startup.
 */
import { aiFailure } from '@shared/ai/errors'
import type { AiErrorCode, Failure } from '@shared/result'

/** Thrown inside the AI layer to unwind to the public method, which returns it as a `Failure`. */
export class AiCallError extends Error {
  constructor(readonly failure: Failure) {
    super(failure.message)
    this.name = 'AiCallError'
  }
}

export const aiError = (code: AiErrorCode, model?: string): AiCallError =>
  new AiCallError(aiFailure(code, { model }))
