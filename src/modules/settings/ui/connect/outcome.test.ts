import { describe, expect, it } from 'vitest'
import type { AiErrorCode } from '@shared/result'
import { asOutcome, isNonBlockingError, outcomeCopy, type TestOutcome } from './outcome'

describe('outcomeCopy', () => {
  it('has the exact pill for every outcome', () => {
    const pills: Record<TestOutcome, string> = {
      connected: 'Connected',
      'invalid-key': 'Key not recognised',
      'no-key': 'Key not recognised',
      'no-credit': 'No credit on this account',
      network: 'Can’t reach Claude',
      'rate-limited': 'Too many requests',
      overloaded: 'Claude is busy',
      'model-unavailable': 'Can’t use this model',
      permission: 'Not allowed',
      refused: 'Something went wrong',
      unknown: 'Something went wrong',
      'too-large': 'Something went wrong'
    }
    for (const [outcome, pill] of Object.entries(pills)) {
      expect(outcomeCopy(outcome as TestOutcome, 'Claude Opus 5.5').pill).toBe(pill)
    }
  })

  it('has no helper for Connected', () => {
    expect(outcomeCopy('connected', 'x')).toEqual({
      pill: 'Connected',
      helper: null,
      consoleLink: false
    })
  })

  it('fills the model name and links the Console only where the spec says', () => {
    expect(outcomeCopy('model-unavailable', 'Claude Sonnet 5.5').helper).toBe(
      'This key can’t use Claude Sonnet 5.5. Choose the other model or check your Claude Console.'
    )
    expect(outcomeCopy('no-credit', 'x').consoleLink).toBe(true)
    expect(outcomeCopy('network', 'x').consoleLink).toBe(false)
  })

  it('gives the generic advice for refused and unknown', () => {
    expect(outcomeCopy('refused', 'x').helper).toBe(
      'Try again. If it keeps happening, create a new key.'
    )
  })
})

describe('isNonBlockingError', () => {
  it('lets the teacher continue after credit, network, busy and model errors', () => {
    const codes: AiErrorCode[] = [
      'no-credit',
      'network',
      'rate-limited',
      'overloaded',
      'model-unavailable',
      'unknown'
    ]
    for (const code of codes) expect(isNonBlockingError(code)).toBe(true)
  })

  it('blocks on a wrong key, a forbidden key, success and no result', () => {
    for (const outcome of ['invalid-key', 'permission', 'no-key', 'connected', null] as const) {
      expect(isNonBlockingError(outcome)).toBe(false)
    }
  })
})

describe('asOutcome', () => {
  it('keeps Claude error codes and turns the rest into unknown', () => {
    expect(asOutcome('no-credit')).toBe('no-credit')
    expect(asOutcome('network')).toBe('network')
    for (const code of ['io', 'cancelled', 'not-found', 'invalid-input', 'file-locked'] as const) {
      expect(asOutcome(code)).toBe('unknown')
    }
  })
})
