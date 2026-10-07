/**
 * 4.7 chatTurn: the editor chat's tool loop (design/ai-pipeline.md §5, §3, §8).
 *
 * - Streams text to the UI as it arrives; each tool call is shown as a progress step.
 * - Append-only: stored history is replayed verbatim, the new turn's raw messages are returned for storage.
 * - `apply_changes` that comes back invalid is retried ONCE (the model sees the errors); a second rejection in a
 *   row ends the turn with "I couldn't make that change cleanly".
 * - Cancelling stops between tool calls and rejects with `cancelled`; changes already applied stay applied
 *   (each was one ChangeSet the UI already has).
 */
import { fail } from '@shared/result'
import { INVALID_OPS, cancelledFailure } from '@shared/ai/errors'
import { EMPTY_USAGE, addUsage } from '@shared/ai/prices'
import type { AiService, ApiMessage, CallOptions, ChatSink, Usage } from '@shared/ai/types'
import type { CallDeps } from '../calls/deps'
import { AiCallError, aiError } from '../errors'
import { buildSystem } from '../prompts/context'
import { EDITOR_CHAT } from '../prompts/system'
import { withTrailingBreakpoint } from '../request'
import type { ContentBlockParam, ToolResultBlockParam, ToolUseBlock } from '../sdk'
import { runTool, toolsFor, type ToolHost } from './tools'
import { buildUserMessage, parseHistory, toParams } from './turn'

const MAX_ROUNDS = 12
/** Two rejected apply_changes in a row end the turn. */
const MAX_REJECTIONS = 2

type ChatInput = Parameters<AiService['chatTurn']>[0]

export async function chatTurn(
  { runner, now }: CallDeps,
  input: ChatInput,
  sink: ChatSink,
  opts: CallOptions = {}
): Promise<{ usage: Usage; apiBlocks: ApiMessage[] }> {
  const history = parseHistory(input.history)
  const host: ToolHost = {
    sink,
    now,
    readSlides: input.readSlides,
    viewSlide: input.viewSlide,
    applyOps: input.applyOps,
    plugins: input.plugins,
    assets: input.assets
  }

  if (input.regions?.length) {
    sink.status('Reading the circled area', 'running')
  }
  const selectedId = (input.selectedSlideJson as { id?: unknown } | undefined)?.id
  const regionSlideIds = [...new Set((input.regions ?? []).map((r) => r.slideId))].filter(
    (id) => id !== selectedId
  )
  const regionSlides = regionSlideIds.length ? (input.readSlides(regionSlideIds) as unknown[]) : []
  const userMessage = buildUserMessage(input, {
    deckOutline: input.deckOutline,
    selectedSlideJson: input.selectedSlideJson,
    regionSlides: Array.isArray(regionSlides) ? regionSlides : [regionSlides]
  })
  if (input.regions?.length) sink.status('Reading the circled area', 'done')

  const system = buildSystem({
    instructions: [EDITOR_CHAT],
    deckModel: true,
    profile: input.profile,
    assets: input.assets?.catalogue.text
  })
  const tools = toolsFor(Boolean(input.plugins), Boolean(input.assets))
  const turn: ApiMessage[] = [userMessage]
  let usage: Usage = { ...EMPTY_USAGE }
  let rejections = 0

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (opts.signal?.aborted) throw new AiCallError(cancelledFailure())
    const result = await runner.run(
      {
        task: 'chatTurn',
        system,
        messages: withTrailingBreakpoint(toParams([...history, ...turn])),
        tools,
        effort: input.effort ?? 'medium',
        maxTokens: 32_000,
        stream: true
      },
      { signal: opts.signal, onText: (delta) => sink.delta(delta) }
    )
    usage = addUsage(usage, result.usage)
    turn.push({ role: 'assistant', content: result.message.content })

    const calls = result.message.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')
    // A tool call cut off by max_tokens has unusable input and cannot be answered.
    if (result.truncated && calls.length > 0) throw aiError('unknown')
    if (calls.length === 0) {
      if (result.message.stop_reason === 'pause_turn') continue
      return { usage, apiBlocks: turn }
    }

    const results: ToolResultBlockParam[] = []
    for (const call of calls) {
      const outcome = await runTool(call, host)
      results.push(outcome.result)
      if (call.name === 'apply_changes') rejections = outcome.rejected ? rejections + 1 : 0
      if (rejections >= MAX_REJECTIONS) throw new AiCallError(fail('invalid-input', INVALID_OPS))
    }
    turn.push({ role: 'user', content: results as ContentBlockParam[] })
  }
  throw aiError('unknown')
}
