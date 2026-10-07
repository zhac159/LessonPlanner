/**
 * Builds the Messages API request for every call, in one place, so the rules hold everywhere:
 * stable -> volatile layout with cache breakpoints (design/ai-pipeline.md §3), adaptive thinking with an explicit
 * effort, structured output via `output_config.format`, `tool_choice: auto` only (forced choice is rejected by
 * Opus 5.5 / Sonnet 5.5), no assistant prefill, refusal fallbacks on.
 */
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { ZodType } from 'zod'
import type { AiTask, Effort, ModelChoice } from '@shared/ai/types'
import type {
  ContentBlockParam,
  CreateParams,
  MessageParam,
  TextBlockParam,
  ToolParam
} from './sdk'

export const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

/** One block of the system prompt. `cache: true` puts a cache breakpoint after it. */
export interface SystemPart {
  text: string
  cache?: boolean
}

export interface CallSpec {
  task: AiTask
  /** Ordered stable -> volatile: [A] instructions, [B] deck model, [C] style profile. Max two breakpoints. */
  system: SystemPart[]
  messages: MessageParam[]
  tools?: ToolParam[]
  /** Structured output schema (zod). The reply text is then JSON matching it. */
  schema?: ZodType
  effort: Effort
  maxTokens: number
  /** Overrides the user's chosen model. */
  model?: ModelChoice
  /** Stream the response (long outputs, live text). Default false. */
  stream?: boolean
  /** Enable server-side refusal fallbacks. Default true. */
  fallbacks?: boolean
  /** Retry once with a larger max_tokens when the output is cut off. Default true. */
  retryOnMaxTokens?: boolean
  /** Retry rate-limit / overloaded / network failures. Default true. */
  retry?: boolean
  timeoutMs?: number
}

const formats = new WeakMap<ZodType, { type: 'json_schema'; schema: Record<string, unknown> }>()

/** JSON-schema output format for a zod schema (converted once per schema object). */
export function outputFormat(schema: ZodType): {
  type: 'json_schema'
  schema: Record<string, unknown>
} {
  let format = formats.get(schema)
  if (!format) {
    const { type, schema: jsonSchema } = zodOutputFormat(schema)
    format = { type, schema: jsonSchema as Record<string, unknown> }
    formats.set(schema, format)
  }
  return format
}

const EPHEMERAL = { type: 'ephemeral' } as const

/** Copy of `messages` with a cache breakpoint on the last block of the last message (originals untouched). */
export function withTrailingBreakpoint(messages: MessageParam[]): MessageParam[] {
  if (messages.length === 0) return messages
  const last = messages[messages.length - 1]
  const blocks: ContentBlockParam[] =
    typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : [...last.content]
  const tail = blocks[blocks.length - 1]
  if (!tail) return messages
  blocks[blocks.length - 1] = { ...tail, cache_control: EPHEMERAL } as ContentBlockParam
  return [...messages.slice(0, -1), { ...last, content: blocks }]
}

/** Marks a block as a cache breakpoint (returns a copy). */
export const cached = <B extends ContentBlockParam>(block: B): B => ({
  ...block,
  cache_control: EPHEMERAL
})

export function buildParams(spec: CallSpec, model: ModelChoice): CreateParams {
  const system: TextBlockParam[] = spec.system.map((part) => ({
    type: 'text',
    text: part.text,
    ...(part.cache ? { cache_control: EPHEMERAL } : {})
  }))
  return {
    model,
    max_tokens: spec.maxTokens,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: spec.effort,
      ...(spec.schema ? { format: outputFormat(spec.schema) } : {})
    },
    system,
    messages: spec.messages,
    ...(spec.tools?.length ? { tools: spec.tools, tool_choice: { type: 'auto' as const } } : {}),
    ...(spec.fallbacks === false ? {} : { betas: [FALLBACK_BETA], fallbacks: 'default' as const })
  }
}
