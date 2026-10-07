import { describe, expect, it } from 'vitest'
import type { AiErrorCode } from '../result'
import { aiErrorMessage, aiFailure, cancelledFailure, isRetryable } from './errors'

const CODES: AiErrorCode[] = [
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

describe('aiErrorMessage', () => {
  it.each([
    ['no-key', 'Claude isn’t connected. Add your API key to keep going.'],
    ['invalid-key', 'Claude isn’t connected. Add your API key to keep going.'],
    ['no-credit', 'Your Claude account is out of credit.'],
    ['rate-limited', 'Claude is busy right now. Try again in a minute.'],
    ['overloaded', 'Claude is busy right now. Try again in a minute.'],
    ['network', 'Can’t reach Claude. Check your internet connection.'],
    ['refused', 'Claude couldn’t help with that request.'],
    ['too-large', 'That file is too big to send to Claude.'],
    ['unknown', 'Something went wrong talking to Claude.']
  ] as const)('%s -> exact copy', (code, message) => {
    expect(aiErrorMessage(code)).toBe(message)
  })

  it('names the model for model-unavailable and permission', () => {
    expect(aiErrorMessage('model-unavailable', 'claude-sonnet-5-5')).toBe(
      'Your API key can’t use Claude Sonnet 5.5. Pick another model in Settings.'
    )
    expect(aiErrorMessage('permission', 'claude-opus-5-5')).toContain('Claude Opus 5.5')
    expect(aiErrorMessage('permission')).toContain('this model')
  })

  it('has a non-empty message for every AI code', () => {
    for (const code of CODES) expect(aiErrorMessage(code).length).toBeGreaterThan(10)
  })
})

describe('failures', () => {
  it('builds a Failure with the retry hint only when given', () => {
    expect(aiFailure('rate-limited')).toEqual({
      ok: false,
      code: 'rate-limited',
      message: 'Claude is busy right now. Try again in a minute.'
    })
    expect(aiFailure('rate-limited', { retryAfterSeconds: 7 }).retryAfterSeconds).toBe(7)
  })

  it('builds the cancelled failure', () => {
    expect(cancelledFailure()).toMatchObject({
      code: 'cancelled',
      message: 'Stopped. Nothing was changed.'
    })
  })

  it('marks transient codes retryable', () => {
    expect(isRetryable('network')).toBe(true)
    expect(isRetryable('overloaded')).toBe(true)
    expect(isRetryable('invalid-key')).toBe(false)
    expect(isRetryable('refused')).toBe(false)
  })
})
