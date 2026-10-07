/**
 * Executes one logical Claude call: acquires the client, retries transient failures, retries once with a higher
 * `max_tokens` when the output was cut off, rejects refusals, logs usage for every response, and (for structured
 * calls) validates the JSON with zod. Everything above this (calls/*.ts) only describes WHAT to ask.
 */
import type { ZodType } from 'zod'
import { EMPTY_USAGE, addUsage } from '@shared/ai/prices'
import type { CallOptions, ModelChoice, Usage } from '@shared/ai/types'
import type { UsageSink } from '../services/usageLog'
import { STREAM_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, type ClientProvider } from './client'
import { aiError, withRetry, type Sleep } from './errors'
import { buildParams, type CallSpec } from './request'
import type { BetaMessage, ClaudeClient } from './sdk'

export interface RunnerDeps {
  provider: ClientProvider
  usage?: UsageSink
  /** Test seam for backoff waits. */
  sleep?: Sleep
}

export interface RunOptions extends CallOptions {
  /** Called with each streamed text delta (only for `spec.stream`). */
  onText?: (delta: string) => void
}

export interface CallResult {
  message: BetaMessage
  /** All text blocks joined. */
  text: string
  /** Usage summed across the retries of this logical call. */
  usage: Usage
  /** True when the output was still cut off after the larger retry (callers decide what a draft is worth). */
  truncated: boolean
}

/** Non-streaming requests are capped below the SDK's "should stream" threshold (~21k tokens). */
const NON_STREAM_MAX_TOKENS = 21_000
const STREAM_MAX_TOKENS = 64_000

export function usageOf(message: BetaMessage): Usage {
  const usage = message.usage
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0
  }
}

export function textOf(message: BetaMessage): string {
  return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('')
}

export class Runner {
  constructor(private readonly deps: RunnerDeps) {}

  model(): ModelChoice {
    return this.deps.provider.model()
  }

  async run(spec: CallSpec, opts: RunOptions = {}): Promise<CallResult> {
    const client = await this.deps.provider.acquire()
    const model = spec.model ?? this.deps.provider.model()
    let total: Usage = { ...EMPTY_USAGE }
    let maxTokens = spec.maxTokens
    let enlarged = false
    for (;;) {
      const message = await this.once(client, { ...spec, maxTokens }, model, opts)
      const usage = usageOf(message)
      total = addUsage(total, usage)
      this.log(message.model || model, spec, usage)
      if (message.stop_reason === 'refusal') throw aiError('refused', model)
      if (message.stop_reason !== 'max_tokens' || enlarged || spec.retryOnMaxTokens === false) {
        return {
          message,
          text: textOf(message),
          usage: total,
          truncated: message.stop_reason === 'max_tokens'
        }
      }
      enlarged = true
      maxTokens = Math.min(spec.stream ? STREAM_MAX_TOKENS : NON_STREAM_MAX_TOKENS, maxTokens * 2)
    }
  }

  /** A call whose reply must be JSON matching `schema`. Throws `unknown` when it does not parse. */
  async runStructured<T>(
    spec: CallSpec & { schema: ZodType<T> },
    opts: RunOptions = {}
  ): Promise<CallResult & { data: T }> {
    const result = await this.run(spec, opts)
    return { ...result, data: parseStructured(result.text, spec.schema, spec.task) }
  }

  private once(
    client: ClaudeClient,
    spec: CallSpec,
    model: ModelChoice,
    opts: RunOptions
  ): Promise<BetaMessage> {
    const params = buildParams(spec, model)
    const request = {
      signal: opts.signal,
      timeout: spec.timeoutMs ?? (spec.stream ? STREAM_TIMEOUT_MS : DEFAULT_TIMEOUT_MS)
    }
    const attempt = async (): Promise<BetaMessage> => {
      if (!spec.stream) return client.beta.messages.create(params, request)
      const stream = client.beta.messages.stream(params, request)
      if (opts.onText) stream.on('text', opts.onText)
      return stream.finalMessage()
    }
    if (spec.retry === false) return attempt()
    return withRetry(attempt, { sleep: this.deps.sleep, signal: opts.signal, model })
  }

  private log(model: string, spec: CallSpec, usage: Usage): void {
    try {
      void Promise.resolve(this.deps.usage?.record({ model, task: spec.task, usage })).catch(
        () => undefined
      )
    } catch {
      /* usage logging is best-effort */
    }
  }
}

/** JSON.parse + zod. A failure here means the model broke its schema: surface it as `unknown`. */
export function parseStructured<T>(text: string, schema: ZodType<T>, task: string): T {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    console.error(`[ai] ${task}: reply was not JSON`)
    throw aiError('unknown')
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    console.error(
      `[ai] ${task}: reply did not match the schema at ${issue.path.join('.') || 'root'}`
    )
    throw aiError('unknown')
  }
  return parsed.data
}
