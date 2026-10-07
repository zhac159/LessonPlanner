/** The real service end to end over a scripted SDK: failures arrive as friendly Results, usage reaches the log. */
import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { aiErrorMessage } from '@shared/ai/errors'
import type { ModelChoice, Usage } from '@shared/ai/types'
import { createAiService } from './index'
import { createStub, jsonMessage, textMessage, type StubReply } from './testing'

const http = (status: number, headers?: Record<string, string>) =>
  Anthropic.APIError.generate(
    status,
    { type: 'error', error: { type: 'x', message: 'nope' } },
    'nope',
    new Headers(headers)
  )

function service(script: StubReply[], model: ModelChoice = 'claude-opus-5-5') {
  const stub = createStub(script)
  const usage: Array<{ model: string; task: string; usage: Usage }> = []
  const waits: number[] = []
  const ai = createAiService({
    getApiKey: () => 'sk-ant-api03-test',
    getModel: () => model,
    createClient: () => stub.client,
    usage: { record: (entry) => void usage.push(entry) },
    sleep: async (ms) => void waits.push(ms)
  })
  return { ai, stub, usage, waits }
}

describe('real service', () => {
  it('returns ok results and records usage with the task name', async () => {
    const { ai, usage } = service([textMessage('ok', { usage: { input: 11, output: 2 } })])
    expect(await ai.testConnection()).toMatchObject({ ok: true, model: 'claude-opus-5-5' })
    expect(usage).toEqual([
      {
        model: 'claude-opus-5-5',
        task: 'testConnection',
        usage: { inputTokens: 11, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 }
      }
    ])
  })

  it.each([
    [401, 'invalid-key'],
    [403, 'permission'],
    [404, 'model-unavailable'],
    [529, 'overloaded'],
    [500, 'unknown']
  ] as const)('maps HTTP %i to %s with the friendly message', async (status, code) => {
    const { ai } = service([http(status)], 'claude-sonnet-5-5')
    const result = await ai.testConnection()
    expect(result).toMatchObject({
      ok: false,
      code,
      message: aiErrorMessage(code, 'claude-sonnet-5-5')
    })
  })

  it('the connection test never waits: a rate limit surfaces immediately with its retry hint', async () => {
    const { ai, waits } = service([http(429, { 'retry-after': '30' })])
    expect(await ai.testConnection()).toMatchObject({
      ok: false,
      code: 'rate-limited',
      retryAfterSeconds: 30
    })
    expect(waits).toEqual([])
  })

  it('other calls back off x3 on rate limits, then report busy', async () => {
    const { ai, stub, waits } = service([http(429), http(429), http(429), http(429)])
    const result = await ai.extractObjectives({ text: 'LO1 something' })
    expect(result).toMatchObject({
      ok: false,
      code: 'rate-limited',
      message: 'Claude is busy right now. Try again in a minute.'
    })
    expect(stub.requests).toHaveLength(4)
    expect(waits).toEqual([1000, 2000, 4000])
  })

  it('recovers when a retry succeeds', async () => {
    const reply = jsonMessage({
      title: 'T',
      subject: '',
      yearGroup: '',
      objectives: ['a'],
      context: ''
    })
    const { ai } = service([http(529), reply])
    expect(await ai.extractObjectives({ text: 'LO1 a' })).toMatchObject({
      ok: true,
      extracted: { objectives: ['a'] }
    })
  })

  it('returns a refusal as the refused failure and a dropped connection as network', async () => {
    const refusal = textMessage('', { stop: 'refusal' })
    const { ai } = service([
      refusal,
      new Anthropic.APIConnectionError({ message: 'offline' }),
      new Anthropic.APIConnectionError({ message: 'offline' })
    ])
    expect(await ai.extractObjectives({ text: 'x' })).toMatchObject({ ok: false, code: 'refused' })
    expect(await ai.extractObjectives({ text: 'x' })).toMatchObject({ ok: false, code: 'network' })
  })

  it('maps an aborted request to cancelled', async () => {
    const { ai } = service([new Anthropic.APIUserAbortError()])
    const controller = new AbortController()
    expect(await ai.extractObjectives({ text: 'x' }, { signal: controller.signal })).toMatchObject({
      ok: false,
      code: 'cancelled'
    })
  })

  it('chatTurn failures are Results too (never thrown)', async () => {
    const { ai } = service([http(401)])
    const result = await ai.chatTurn(
      {
        lessonId: 'l',
        messageId: 'm',
        text: 'hi',
        profile: null,
        deckOutline: [],
        history: [],
        applyOps: async () => ({ ok: true, changeSetId: 'x' }),
        readSlides: () => [],
        viewSlide: async () => new Uint8Array()
      },
      { delta: () => {}, status: () => {}, changes: () => {} }
    )
    expect(result).toMatchObject({ ok: false, code: 'invalid-key' })
  })

  it('structured() validates against the caller’s schema', async () => {
    const { ai } = service([jsonMessage({ n: 2 })])
    expect(
      await ai.structured({ instructions: 'i', prompt: 'p', schema: z.object({ n: z.number() }) })
    ).toMatchObject({ ok: true, data: { n: 2 } })
  })

  it('never puts the key into a failure message', async () => {
    const { ai } = service([new Error('request failed for key sk-ant-api03-test')])
    const result = await ai.extractObjectives({ text: 'x' })
    expect(JSON.stringify(result)).not.toContain('sk-ant-api03-test')
  })
})
