import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  FALLBACK_BETA,
  buildParams,
  cached,
  outputFormat,
  withTrailingBreakpoint,
  type CallSpec
} from './request'
import type { MessageParam } from './sdk'

const spec = (extra: Partial<CallSpec> = {}): CallSpec => ({
  task: 'planLesson',
  system: [
    { text: 'A+B stable', cache: true },
    { text: 'C profile', cache: true }
  ],
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
  effort: 'medium',
  maxTokens: 1000,
  ...extra
})

describe('buildParams', () => {
  it('sets model, adaptive thinking, explicit effort and fallbacks', () => {
    const params = buildParams(spec(), 'claude-opus-5-5')
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 1000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      betas: [FALLBACK_BETA],
      fallbacks: 'default'
    })
  })

  it('puts cache breakpoints on the stable system blocks, in order', () => {
    const params = buildParams(
      spec({ system: [{ text: 'A', cache: true }, { text: 'C' }] }),
      'claude-opus-5-5'
    )
    expect(params.system).toEqual([
      { type: 'text', text: 'A', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'C' }
    ])
  })

  it('never forces a tool and never prefills the assistant', () => {
    const tools = [{ name: 't', description: 'd', input_schema: { type: 'object' as const } }]
    const params = buildParams(spec({ tools }), 'claude-opus-5-5')
    expect(params.tool_choice).toEqual({ type: 'auto' })
    expect(params.messages.at(-1)?.role).toBe('user')
  })

  it('omits tool_choice when there are no tools', () => {
    expect(buildParams(spec(), 'claude-opus-5-5').tool_choice).toBeUndefined()
  })

  it('adds a json_schema output format for structured calls', () => {
    const schema = z.object({ title: z.string(), n: z.number() })
    const params = buildParams(spec({ schema }), 'claude-opus-5-5')
    const format = params.output_config?.format
    expect(format?.type).toBe('json_schema')
    expect(format?.schema).toMatchObject({ type: 'object', additionalProperties: false })
    expect(params.output_config?.effort).toBe('medium')
  })

  it('can switch fallbacks off', () => {
    const params = buildParams(spec({ fallbacks: false }), 'claude-sonnet-5-5')
    expect(params.betas).toBeUndefined()
    expect(params.fallbacks).toBeUndefined()
    expect(params.model).toBe('claude-sonnet-5-5')
  })
})

describe('outputFormat', () => {
  it('converts a schema once and reuses the result', () => {
    const schema = z.object({ a: z.string() })
    expect(outputFormat(schema)).toBe(outputFormat(schema))
  })
})

describe('cache helpers', () => {
  const messages: MessageParam[] = [
    { role: 'user', content: [{ type: 'text', text: 'one' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'two' }] },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'a' },
        { type: 'text', text: 'b' }
      ]
    }
  ]

  it('marks only the last block of the last message and leaves the originals alone', () => {
    const marked = withTrailingBreakpoint(messages)
    const last = marked[2].content as Array<{ cache_control?: unknown }>
    expect(last[0].cache_control).toBeUndefined()
    expect(last[1].cache_control).toEqual({ type: 'ephemeral' })
    expect(JSON.stringify(messages)).not.toContain('cache_control')
    expect(marked[0]).toBe(messages[0])
  })

  it('wraps string content and tolerates empty lists', () => {
    const marked = withTrailingBreakpoint([{ role: 'user', content: 'plain' }])
    expect(marked[0].content).toEqual([
      { type: 'text', text: 'plain', cache_control: { type: 'ephemeral' } }
    ])
    expect(withTrailingBreakpoint([])).toEqual([])
  })

  it('marks a single block with cached()', () => {
    expect(cached({ type: 'text', text: 'x' })).toEqual({
      type: 'text',
      text: 'x',
      cache_control: { type: 'ephemeral' }
    })
  })
})
