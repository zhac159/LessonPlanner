/**
 * The narrow slice of `@anthropic-ai/sdk` the AI layer uses, as types. Everything in src/main/ai depends on
 * `ClaudeClient` (not on the SDK class), so tests inject a stub with the same shape and the SDK is touched in
 * exactly one place (`client.ts`). We use the `beta` namespace because refusal fallbacks live there.
 */
import type Anthropic from '@anthropic-ai/sdk'

export type BetaMessage = Anthropic.Beta.BetaMessage
export type MessageParam = Anthropic.Beta.BetaMessageParam
export type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam
export type TextBlockParam = Anthropic.Beta.BetaTextBlockParam
export type ToolParam = Anthropic.Beta.BetaTool
export type ToolResultBlockParam = Anthropic.Beta.BetaToolResultBlockParam
export type ToolUseBlock = Anthropic.Beta.BetaToolUseBlock
export type CreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming

/** Per-request options (cancellation and timeout). */
export interface RequestOptions {
  signal?: AbortSignal
  timeout?: number
}

/** What `client.beta.messages.stream()` returns, reduced to what we use. */
export interface MessageStreamLike {
  on(event: 'text', listener: (delta: string) => void): unknown
  finalMessage(): Promise<BetaMessage>
}

export interface ClaudeClient {
  beta: {
    messages: {
      create(params: CreateParams, options?: RequestOptions): PromiseLike<BetaMessage>
      stream(params: CreateParams, options?: RequestOptions): MessageStreamLike
    }
  }
}
