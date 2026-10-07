import { describe, expect, it } from 'vitest'
import type { AiErrorCode } from '@shared/result'
import {
  ERROR_ACTION_LABELS,
  errorActionFor,
  errorFromEvent,
  errorFromFailure,
  isStopped
} from './errors'

const event = (
  code: AiErrorCode,
  extra: { scope?: 'chat' | 'generation' | 'plugin'; retryable?: boolean } = {}
) => ({
  scope: extra.scope ?? ('chat' as const),
  code,
  message: `message for ${code}`,
  retryable: extra.retryable ?? false
})

describe('errorActionFor (the one button per error, README "Shared AI error copy")', () => {
  it.each(['no-key', 'invalid-key', 'permission', 'model-unavailable'] as const)(
    '%s opens Settings',
    (code) => expect(errorActionFor(event(code))).toBe('settings')
  )

  it('sends out-of-credit to the console', () => {
    expect(errorActionFor(event('no-credit'))).toBe('console')
  })

  it.each(['rate-limited', 'overloaded', 'network', 'unknown'] as const)(
    '%s offers Try again when it can be retried',
    (code) => expect(errorActionFor(event(code, { retryable: true }))).toBe('retry')
  )

  it.each(['refused', 'too-large'] as const)('%s offers nothing', (code) => {
    expect(errorActionFor(event(code, { retryable: true }))).toBeUndefined()
  })

  it('offers "Finish the rest" for a generation that failed', () => {
    expect(errorActionFor(event('network', { scope: 'generation', retryable: true }))).toBe(
      'finish'
    )
  })

  it('offers nothing for a failure that cannot be retried', () => {
    expect(errorActionFor(event('unknown'))).toBeUndefined()
  })
})

describe('building an error message', () => {
  it('carries the code, the message and the action from an ai:error event', () => {
    expect(errorFromEvent(event('network', { retryable: true }))).toEqual({
      code: 'network',
      message: 'message for network',
      action: 'retry'
    })
  })

  it('omits the action when there is none', () => {
    expect(errorFromEvent(event('refused'))).toEqual({
      code: 'refused',
      message: 'message for refused'
    })
  })

  it('maps a failed start call to Settings or the console, or to no action', () => {
    expect(errorFromFailure({ code: 'no-key', message: 'm' }).action).toBe('settings')
    expect(errorFromFailure({ code: 'no-credit', message: 'm' }).action).toBe('console')
    expect(errorFromFailure({ code: 'invalid-input', message: 'm' }).action).toBeUndefined()
  })

  it('knows a stopped turn', () => {
    expect(isStopped({ code: 'cancelled', message: 'Stopped.' })).toBe(true)
    expect(isStopped({ code: 'network', message: '' })).toBe(false)
    expect(isStopped(undefined)).toBe(false)
  })

  it('has a label for every action', () => {
    expect(ERROR_ACTION_LABELS).toEqual({
      retry: 'Try again',
      settings: 'Open Settings',
      console: 'Open platform.claude.com ↗',
      finish: 'Finish the rest'
    })
  })
})
