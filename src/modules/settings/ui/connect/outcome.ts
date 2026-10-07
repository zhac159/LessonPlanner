/**
 * What the Connect Claude form says about a connection test (design/screens/02-connect-claude.md §5 table).
 * Pure: the pill, the helper line and whether the result stops the first-run wizard.
 */
import type { AiErrorCode, ErrorCode } from '@shared/result'

/** The result of a test: `connected` or the failure code. */
export type TestOutcome = 'connected' | AiErrorCode

export interface OutcomeCopy {
  /** Short word(s) in the StatusPill. */
  pill: string
  /** Helper line under the test row; null when there is nothing to add. */
  helper: string | null
  /** Show the "platform.claude.com ↗" link after the helper. */
  consoleLink: boolean
}

const GENERIC: OutcomeCopy = {
  pill: 'Something went wrong',
  helper: 'Try again. If it keeps happening, create a new key.',
  consoleLink: false
}

/** The pill and helper for an outcome. `modelName` fills the "{model name}" slot. */
export function outcomeCopy(outcome: TestOutcome, modelName: string): OutcomeCopy {
  switch (outcome) {
    case 'connected':
      return { pill: 'Connected', helper: null, consoleLink: false }
    case 'invalid-key':
    case 'no-key':
      return {
        pill: 'Key not recognised',
        helper: 'Check you copied the whole key. It starts with sk-ant-.',
        consoleLink: false
      }
    case 'no-credit':
      return {
        pill: 'No credit on this account',
        helper: 'Add credit in the Claude Console, then test again.',
        consoleLink: true
      }
    case 'network':
      return {
        pill: 'Can’t reach Claude',
        helper: 'Check your internet connection, then test again.',
        consoleLink: false
      }
    case 'rate-limited':
      return {
        pill: 'Too many requests',
        helper: 'Wait a minute, then test again.',
        consoleLink: false
      }
    case 'overloaded':
      return {
        pill: 'Claude is busy',
        helper: 'Claude is very busy right now. Try again in a minute.',
        consoleLink: false
      }
    case 'model-unavailable':
      return {
        pill: 'Can’t use this model',
        helper: `This key can’t use ${modelName}. Choose the other model or check your Claude Console.`,
        consoleLink: false
      }
    case 'permission':
      return {
        pill: 'Not allowed',
        helper: 'This key isn’t allowed to use Claude. Check its workspace in the Claude Console.',
        consoleLink: false
      }
    default:
      return GENERIC
  }
}

/** Outcomes that stop "Next: your style" for good: the key itself is wrong (02 §8 step 6). */
const BLOCKING: ReadonlySet<TestOutcome> = new Set(['invalid-key', 'permission', 'no-key'])

/** True when the outcome is an error that still lets the teacher continue ("Continue anyway"). */
export const isNonBlockingError = (outcome: TestOutcome | null): boolean =>
  outcome !== null && outcome !== 'connected' && !BLOCKING.has(outcome)

const NON_AI_CODES: ReadonlySet<ErrorCode> = new Set([
  'not-found',
  'invalid-input',
  'io',
  'file-locked',
  'cancelled'
])

/** A `testConnection` failure code as an outcome; codes that are not Claude errors read as "unknown". */
export const asOutcome = (code: ErrorCode): TestOutcome =>
  NON_AI_CODES.has(code) ? 'unknown' : (code as AiErrorCode)
