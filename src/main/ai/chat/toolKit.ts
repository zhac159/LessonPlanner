/** Small pieces every chat tool shares: the definition builder, the `tool_result` builders and the outcome type. */
import type { z } from 'zod'
import type { ToolParam, ToolResultBlockParam } from '../sdk'

export const tool = (
  name: string,
  description: string,
  properties: object,
  required: string[],
  strict: boolean
): ToolParam => ({
  name,
  description,
  input_schema: {
    type: 'object',
    properties,
    required,
    ...(strict ? { additionalProperties: false } : {})
  },
  ...(strict ? { strict: true } : {}),
  eager_input_streaming: true
})

/** The outcome of one tool call: the `tool_result` and, for apply_changes, whether it was an invalid attempt. */
export interface ToolOutcome {
  result: ToolResultBlockParam
  /** True when apply_changes was rejected (bad input or invalid ops). */
  rejected: boolean
}

export const text = (id: string, content: string, isError = false): ToolResultBlockParam => ({
  type: 'tool_result',
  tool_use_id: id,
  content,
  ...(isError ? { is_error: true } : {})
})

export const invalidInput = (id: string, error: z.ZodError): ToolOutcome => ({
  result: text(
    id,
    `Invalid input: ${error.issues[0]?.path.join('.') || 'input'}: ${error.issues[0]?.message}`,
    true
  ),
  rejected: true
})
