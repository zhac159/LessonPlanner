import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { CallSpec } from './request'
import { createRig, jsonMessage, message, textMessage } from './testing'

const spec = (extra: Partial<CallSpec> = {}): CallSpec => ({
  task: 'writeSlide',
  system: [{ text: 'sys', cache: true }],
  messages: [{ role: 'user', content: 'go' }],
  effort: 'low',
  maxTokens: 1000,
  ...extra
})

describe('Runner.run', () => {
  it('returns text and usage, and logs usage once per response with the answering model', async () => {
    const rig = createRig([
      textMessage('hello', { usage: { input: 100, output: 20, read: 50, write: 5 } })
    ])
    const result = await rig.runner.run(spec())
    expect(result.text).toBe('hello')
    expect(result.usage).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 50,
      cacheWriteTokens: 5
    })
    expect(rig.usage).toEqual([
      { model: 'claude-opus-5-5', task: 'writeSlide', usage: result.usage }
    ])
  })

  it('uses the chosen model unless the spec overrides it', async () => {
    const rig = createRig([textMessage('a'), textMessage('b')], 'claude-sonnet-5-5')
    await rig.runner.run(spec())
    await rig.runner.run(spec({ model: 'claude-opus-5-5' }))
    expect(rig.stub.requests.map((r) => r.model)).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5'])
  })

  it('streams when asked, forwarding text deltas', async () => {
    const rig = createRig([textMessage('streamed answer text')])
    const chunks: string[] = []
    const result = await rig.runner.run(spec({ stream: true }), { onText: (d) => chunks.push(d) })
    expect(rig.stub.streamed).toEqual([true])
    expect(chunks.join('')).toBe('streamed answer text')
    expect(result.text).toBe('streamed answer text')
  })

  it('maps a refusal to the refused failure', async () => {
    const rig = createRig([message({ stop: 'refusal' })])
    await expect(rig.runner.run(spec())).rejects.toMatchObject({ failure: { code: 'refused' } })
  })

  it('retries once with a larger max_tokens when cut off, summing usage', async () => {
    const rig = createRig([
      textMessage('cut', { stop: 'max_tokens', usage: { output: 1000 } }),
      textMessage('complete', { usage: { output: 1500 } })
    ])
    const result = await rig.runner.run(spec())
    expect(rig.stub.requests.map((r) => r.max_tokens)).toEqual([1000, 2000])
    expect(result.text).toBe('complete')
    expect(result.truncated).toBe(false)
    expect(result.usage.outputTokens).toBe(2500)
    expect(rig.usage).toHaveLength(2)
  })

  it('caps the larger limit (non-streaming 21k, streaming 64k) and reports a second cut-off as truncated', async () => {
    const rig = createRig([
      textMessage('a', { stop: 'max_tokens' }),
      textMessage('b', { stop: 'max_tokens' }),
      textMessage('c', { stop: 'max_tokens' }),
      textMessage('d', { stop: 'max_tokens' })
    ])
    const plain = await rig.runner.run(spec({ maxTokens: 16000 }))
    expect(rig.stub.requests[1].max_tokens).toBe(21_000)
    expect(plain.truncated).toBe(true)
    await rig.runner.run(spec({ maxTokens: 50_000, stream: true }))
    expect(rig.stub.requests[3].max_tokens).toBe(64_000)
  })

  it('retries rate limits with backoff then succeeds', async () => {
    const limited = Anthropic.APIError.generate(
      429,
      {},
      'slow',
      new Headers({ 'retry-after': '5' })
    )
    const rig = createRig([limited, textMessage('ok')])
    const result = await rig.runner.run(spec())
    expect(result.text).toBe('ok')
    expect(rig.waits).toEqual([5000])
  })

  it('does not retry when retry is false', async () => {
    const rig = createRig([
      Anthropic.APIError.generate(429, {}, 'slow', new Headers()),
      textMessage('ok')
    ])
    await expect(rig.runner.run(spec({ retry: false }))).rejects.toBeInstanceOf(
      Anthropic.RateLimitError
    )
    expect(rig.stub.requests).toHaveLength(1)
  })

  it('fails with no-key before any request when no key is saved', async () => {
    const rig = createRig([textMessage('x')])
    const { createClientProvider } = await import('./client')
    const { Runner } = await import('./runner')
    const runner = new Runner({
      provider: createClientProvider({ getApiKey: () => null, getModel: () => rig.runner.model() })
    })
    await expect(runner.run(spec())).rejects.toMatchObject({ failure: { code: 'no-key' } })
    expect(rig.stub.requests).toHaveLength(0)
  })

  it('passes the signal and a timeout to the SDK, and aborts cleanly', async () => {
    const controller = new AbortController()
    const rig = createRig([textMessage('x')])
    await rig.runner.run(spec(), { signal: controller.signal })
    expect(rig.stub.options[0].signal).toBe(controller.signal)
    expect(rig.stub.options[0].timeout).toBeGreaterThan(0)

    controller.abort()
    await expect(rig.runner.run(spec(), { signal: controller.signal })).rejects.toBeDefined()
  })

  it('honours the per-call timeout', async () => {
    const rig = createRig([textMessage('x')])
    await rig.runner.run(spec({ timeoutMs: 15_000 }))
    expect(rig.stub.options[0].timeout).toBe(15_000)
  })
})

describe('Runner.runStructured', () => {
  const schema = z.object({ title: z.string() })

  it('validates the JSON against the schema', async () => {
    const rig = createRig([jsonMessage({ title: 'Hi' })])
    const result = await rig.runner.runStructured({ ...spec(), schema })
    expect(result.data).toEqual({ title: 'Hi' })
    expect(rig.stub.requests[0].output_config?.format?.type).toBe('json_schema')
  })

  it('fails with unknown when the reply is not JSON or does not match', async () => {
    const rig = createRig([textMessage('not json'), jsonMessage({ title: 5 })])
    await expect(rig.runner.runStructured({ ...spec(), schema })).rejects.toMatchObject({
      failure: { code: 'unknown' }
    })
    await expect(rig.runner.runStructured({ ...spec(), schema })).rejects.toMatchObject({
      failure: { code: 'unknown' }
    })
  })
})
