/**
 * What actually goes over HTTP: the real SDK builds the request from our params, with `fetch` replaced by a
 * recorder. Guards against SDK-shape drift (beta header, body fields) without touching the network.
 */
import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { buildParams, FALLBACK_BETA } from './request'
import { DECK_MODEL } from './prompts/deckModel'

async function captureRequest(params: ReturnType<typeof buildParams>) {
  const seen: { headers: Headers; body: Record<string, unknown> }[] = []
  const client = new Anthropic({
    apiKey: 'sk-ant-api03-test',
    maxRetries: 0,
    fetch: async (_url, init) => {
      seen.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) })
      return new Response(
        JSON.stringify({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5-5',
          content: [{ type: 'text', text: '{}' }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 }
        }),
        { headers: { 'content-type': 'application/json' } }
      )
    }
  })
  await client.beta.messages.create(params)
  return seen[0]
}

describe('request on the wire', () => {
  const params = buildParams(
    {
      task: 'writeSlide',
      system: [
        { text: 'A', cache: true },
        { text: 'C', cache: true }
      ],
      messages: [{ role: 'user', content: 'go' }],
      schema: z.object({ title: z.string() }),
      effort: 'medium',
      maxTokens: 500
    },
    'claude-opus-5-5'
  )

  it('sends the fallback beta as a header and the rest as body fields', async () => {
    const { headers, body } = await captureRequest(params)
    expect(headers.get('anthropic-beta')).toContain(FALLBACK_BETA)
    expect(headers.get('x-api-key')).toBe('sk-ant-api03-test')
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 500,
      thinking: { type: 'adaptive' },
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema' } }
    })
    expect(body.betas).toBeUndefined()
    expect(body.tool_choice).toBeUndefined()
    const system = body.system as Array<{ cache_control?: unknown }>
    expect(system.map((s) => s.cache_control)).toEqual([
      { type: 'ephemeral' },
      { type: 'ephemeral' }
    ])
  })

  it('serialises the JSON schema the model must follow', async () => {
    const { body } = await captureRequest(params)
    const format = (body.output_config as { format: { schema: Record<string, unknown> } }).format
    expect(format.schema).toMatchObject({
      type: 'object',
      required: ['title'],
      additionalProperties: false
    })
  })
})

describe('deck model prompt', () => {
  it('names every operation, element type and slide kind (guards drift from src/shared/deck/types.ts)', () => {
    const names = [
      'insertSlides',
      'deleteSlides',
      'moveSlide',
      'replaceSlide',
      'updateSlide',
      'addElement',
      'updateElement',
      'removeElement',
      'setMeta',
      'text',
      'chips',
      'callout',
      'image',
      'diagram',
      'shape',
      'table',
      'title',
      'do-now',
      'objectives',
      'key-words',
      'content',
      'question',
      'activity',
      'practical',
      'check',
      'plenary',
      'exit-ticket',
      'quiz',
      'answers',
      'section',
      'custom'
    ]
    for (const name of names) expect(DECK_MODEL).toContain(name)
  })
})
