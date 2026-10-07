/**
 * Test helpers for the AI layer (used by *.test.ts only): a scripted stub of the SDK client that records every
 * request, canned `BetaMessage` builders, and a ready-made `Runner` wired to the stub. No network, no electron.
 */
import type { Usage } from '@shared/ai/types'
import type { UsageSink } from '../services/usageLog'
import { createClientProvider } from './client'
import { Runner } from './runner'
import type {
  BetaMessage,
  ClaudeClient,
  CreateParams,
  MessageStreamLike,
  RequestOptions
} from './sdk'

export type StubReply = BetaMessage | Error | ((params: CreateParams) => BetaMessage | Error)

export interface Stub {
  client: ClaudeClient
  /** Every request body, in order. */
  requests: CreateParams[]
  /** Every request's options (signal, timeout). */
  options: RequestOptions[]
  /** Which calls used `.stream()`. */
  streamed: boolean[]
}

type Block = Record<string, unknown>

interface MessageInit {
  content?: Block[]
  stop?: string
  usage?: Partial<{ input: number; output: number; read: number; write: number }>
  model?: string
}

/** A canned assistant message. */
export function message(init: MessageInit = {}): BetaMessage {
  const usage = init.usage ?? {}
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: init.model ?? 'claude-opus-5-5',
    content: init.content ?? [],
    stop_reason: init.stop ?? 'end_turn',
    stop_sequence: null,
    stop_details: null,
    usage: {
      input_tokens: usage.input ?? 10,
      output_tokens: usage.output ?? 5,
      cache_read_input_tokens: usage.read ?? 0,
      cache_creation_input_tokens: usage.write ?? 0
    }
  } as unknown as BetaMessage
}

export const textMessage = (text: string, init: MessageInit = {}): BetaMessage =>
  message({ ...init, content: [{ type: 'text', text }] })

export const jsonMessage = (value: unknown, init: MessageInit = {}): BetaMessage =>
  textMessage(JSON.stringify(value), init)

export const toolUse = (id: string, name: string, input: unknown): Block => ({
  type: 'tool_use',
  id,
  name,
  input
})

export const toolUseMessage = (blocks: Block[], init: MessageInit = {}): BetaMessage =>
  message({ stop: 'tool_use', ...init, content: blocks })

/** Scripted client: each call takes the next reply (an Error is thrown, a function is called). */
export function createStub(script: StubReply[]): Stub {
  const queue = [...script]
  const stub: Stub = { requests: [], options: [], streamed: [], client: undefined as never }

  const next = (params: CreateParams, options: RequestOptions | undefined, streamed: boolean) => {
    stub.requests.push(structuredClone(params))
    stub.options.push(options ?? {})
    stub.streamed.push(streamed)
    if (options?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
    const reply = queue.shift()
    if (reply === undefined) throw new Error('stub: no scripted reply left')
    const value = typeof reply === 'function' ? reply(params) : reply
    if (value instanceof Error) throw value
    return value
  }

  stub.client = {
    beta: {
      messages: {
        create: async (params, options) => next(params, options, false),
        stream: (params, options): MessageStreamLike => {
          const listeners: Array<(delta: string) => void> = []
          return {
            on(_event, listener) {
              listeners.push(listener)
            },
            async finalMessage() {
              const result = next(params, options, true)
              for (const block of result.content) {
                if (block.type !== 'text') continue
                for (const part of block.text.match(/.{1,16}/gs) ?? [])
                  listeners.forEach((l) => l(part))
              }
              return result
            }
          }
        }
      }
    }
  }
  return stub
}

export interface TestRig {
  runner: Runner
  stub: Stub
  /** Usage records written by the runner. */
  usage: Array<{ model: string; task: string; usage: Usage }>
  waits: number[]
}

/** A `Runner` over a scripted stub, with instant backoff and a recording usage sink. */
export function createRig(
  script: StubReply[],
  model: 'claude-opus-5-5' | 'claude-sonnet-5-5' = 'claude-opus-5-5'
): TestRig {
  const stub = createStub(script)
  const usage: TestRig['usage'] = []
  const waits: number[] = []
  const sink: UsageSink = { record: (entry) => void usage.push(entry) }
  const runner = new Runner({
    provider: createClientProvider({
      getApiKey: () => 'sk-ant-api03-test-key',
      getModel: () => model,
      createClient: () => stub.client
    }),
    usage: sink,
    sleep: async (ms) => void waits.push(ms)
  })
  return { runner, stub, usage, waits }
}

/** Problems that would make a JSON schema invalid for structured outputs (objects must be closed and fully required). */
export function strictViolations(node: unknown, path = '$'): string[] {
  if (Array.isArray(node)) return node.flatMap((item, i) => strictViolations(item, `${path}[${i}]`))
  if (!node || typeof node !== 'object') return []
  const record = node as Record<string, unknown>
  const problems: string[] = []
  const properties = record.properties as Record<string, unknown> | undefined
  if (record.type === 'object' && properties) {
    if (record.additionalProperties !== false)
      problems.push(`${path}: additionalProperties is not false`)
    const required = new Set((record.required as string[] | undefined) ?? [])
    for (const key of Object.keys(properties)) {
      if (!required.has(key)) problems.push(`${path}.${key}: optional property`)
    }
  }
  for (const [key, value] of Object.entries(record))
    problems.push(...strictViolations(value, `${path}.${key}`))
  return problems
}
