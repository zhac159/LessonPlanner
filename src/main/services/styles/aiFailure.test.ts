import { describe, expect, it } from 'vitest'
import { fail } from '@shared/result'
import { fileErrorFromFailure, isAccountError } from './aiFailure'

describe('aiFailure', () => {
  it('uses the spec wording and marks what can be retried', () => {
    expect(fileErrorFromFailure(fail('network', 'x'))).toEqual({
      code: 'network',
      message: 'Couldn’t reach Claude',
      retryable: true
    })
    expect(fileErrorFromFailure(fail('rate-limited', 'x'))).toMatchObject({
      message: 'Claude was busy',
      retryable: true
    })
    expect(fileErrorFromFailure(fail('too-large', 'x')).retryable).toBe(false)
    expect(fileErrorFromFailure(fail('refused', 'No can do'))).toEqual({
      code: 'refused',
      message: 'No can do',
      retryable: false
    })
    expect(fileErrorFromFailure(fail('unknown', 'odd')).retryable).toBe(true)
  })

  it('treats account problems as queue-wide', () => {
    for (const code of ['no-key', 'invalid-key', 'no-credit', 'permission'] as const) {
      expect(isAccountError(code)).toBe(true)
    }
    for (const code of ['network', 'overloaded', 'cancelled', 'io'] as const) {
      expect(isAccountError(code)).toBe(false)
    }
  })
})
