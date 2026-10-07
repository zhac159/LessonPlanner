import Anthropic from '@anthropic-ai/sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aiFailure } from '@shared/ai/errors'
import {
  AiCallError,
  abortableSleep,
  aiError,
  backoffMs,
  guarded,
  mapSdkError,
  withRetry,
  type Sleep
} from './errors'

const apiError = (status: number, message = 'boom', headers?: Record<string, string>) =>
  Anthropic.APIError.generate(
    status,
    { type: 'error', error: { type: 'x', message } },
    message,
    new Headers(headers)
  )

describe('mapSdkError', () => {
  it.each([
    [401, 'invalid-key'],
    [403, 'permission'],
    [404, 'model-unavailable'],
    [413, 'too-large'],
    [429, 'rate-limited'],
    [529, 'overloaded'],
    [503, 'overloaded'],
    [500, 'unknown'],
    [400, 'unknown'],
    [422, 'unknown']
  ] as const)('HTTP %i -> %s', (status, code) => {
    expect(mapSdkError(apiError(status))).toMatchObject({ ok: false, code })
  })

  it('maps a low credit balance 400 to no-credit', () => {
    const error = apiError(400, 'Your credit balance is too low to access the Anthropic API.')
    expect(mapSdkError(error).code).toBe('no-credit')
  })

  it('reads retry-after from the headers', () => {
    expect(mapSdkError(apiError(429, 'slow', { 'retry-after': '12' })).retryAfterSeconds).toBe(12)
    expect(mapSdkError(apiError(429, 'slow')).retryAfterSeconds).toBeUndefined()
    expect(
      mapSdkError(apiError(429, 'slow', { 'retry-after': 'soon' })).retryAfterSeconds
    ).toBeUndefined()
  })

  it('maps connection problems and timeouts to network', () => {
    expect(mapSdkError(new Anthropic.APIConnectionError({ message: 'offline' })).code).toBe(
      'network'
    )
    expect(mapSdkError(new Anthropic.APIConnectionTimeoutError()).code).toBe('network')
  })

  it('maps aborts (SDK and native) to cancelled', () => {
    expect(mapSdkError(new Anthropic.APIUserAbortError()).code).toBe('cancelled')
    expect(mapSdkError(new DOMException('aborted', 'AbortError')).code).toBe('cancelled')
  })

  it('names the model in model-unavailable and permission messages', () => {
    const failure = mapSdkError(apiError(404), { model: 'claude-sonnet-5-5' })
    expect(failure.message).toContain('Claude Sonnet 5.5')
  })

  it('passes our own AiCallError through unchanged', () => {
    expect(mapSdkError(aiError('refused'))).toEqual(aiFailure('refused'))
  })

  it('maps unknown throwables to unknown and never prints the key', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = mapSdkError(new Error('bad thing with sk-ant-api03-LEAKME inside'))
    expect(failure.code).toBe('unknown')
    expect(failure.message).not.toContain('LEAKME')
    expect(JSON.stringify(spy.mock.calls)).not.toContain('LEAKME')
    spy.mockRestore()
  })
})

describe('guarded', () => {
  it('wraps success as ok and failures as Failure', async () => {
    expect(await guarded(async () => ({ value: 1 }))).toEqual({ ok: true, value: 1 })
    const failed = await guarded(async () => {
      throw apiError(401)
    })
    expect(failed).toMatchObject({ ok: false, code: 'invalid-key' })
  })
})

describe('backoffMs', () => {
  it('doubles from one second and honours retry-after, capped at 30 s', () => {
    const base = aiFailure('rate-limited')
    expect(backoffMs(0, base)).toBe(1000)
    expect(backoffMs(2, base)).toBe(4000)
    expect(backoffMs(0, aiFailure('rate-limited', { retryAfterSeconds: 9 }))).toBe(9000)
    expect(backoffMs(0, aiFailure('rate-limited', { retryAfterSeconds: 500 }))).toBe(30_000)
  })
})

describe('withRetry', () => {
  const instant = (): { sleep: Sleep; waits: number[] } => {
    const waits: number[] = []
    return { waits, sleep: async (ms) => void waits.push(ms) }
  }

  it('retries rate limits up to three times then succeeds', async () => {
    const { sleep, waits } = instant()
    let calls = 0
    const result = await withRetry(
      async () => {
        calls += 1
        if (calls < 4) throw apiError(429, 'slow')
        return 'done'
      },
      { sleep }
    )
    expect(result).toBe('done')
    expect(calls).toBe(4)
    expect(waits).toEqual([1000, 2000, 4000])
  })

  it('gives up after three retries and rethrows the last error', async () => {
    const { sleep } = instant()
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls += 1
          throw apiError(529)
        },
        { sleep }
      )
    ).rejects.toBeInstanceOf(Anthropic.InternalServerError)
    expect(calls).toBe(4)
  })

  it('retries a network error once', async () => {
    const { sleep } = instant()
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls += 1
          throw new Anthropic.APIConnectionError({ message: 'x' })
        },
        { sleep }
      )
    ).rejects.toThrow()
    expect(calls).toBe(2)
  })

  it.each([401, 403, 404, 400])('does not retry HTTP %i', async (status) => {
    const { sleep } = instant()
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls += 1
          throw apiError(status)
        },
        { sleep }
      )
    ).rejects.toBeDefined()
    expect(calls).toBe(1)
  })

  it('does not retry once the signal is aborted', async () => {
    const { sleep } = instant()
    const controller = new AbortController()
    controller.abort()
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls += 1
          throw apiError(429)
        },
        { sleep, signal: controller.signal }
      )
    ).rejects.toBeDefined()
    expect(calls).toBe(1)
  })

  it('passes AiCallError through without retrying', async () => {
    const { sleep } = instant()
    let calls = 0
    await expect(
      withRetry(
        async () => {
          calls += 1
          throw aiError('refused')
        },
        { sleep }
      )
    ).rejects.toBeInstanceOf(AiCallError)
    expect(calls).toBe(1)
  })
})

describe('abortableSleep', () => {
  afterEach(() => vi.useRealTimers())

  it('resolves after the delay', async () => {
    vi.useFakeTimers()
    const done = vi.fn()
    const pending = abortableSleep(500).then(done)
    await vi.advanceTimersByTimeAsync(499)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2)
    await pending
    expect(done).toHaveBeenCalled()
  })

  it('rejects immediately when aborted before or during the wait', async () => {
    const early = new AbortController()
    early.abort()
    await expect(abortableSleep(10_000, early.signal)).rejects.toBeInstanceOf(
      Anthropic.APIUserAbortError
    )
    const later = new AbortController()
    const pending = abortableSleep(10_000, later.signal)
    later.abort()
    await expect(pending).rejects.toBeInstanceOf(Anthropic.APIUserAbortError)
  })
})
