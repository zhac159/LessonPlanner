/**
 * Builds the volatile tail [F] of a chat request: the latest user turn with the deck snapshot, region images and
 * the teacher's words (design/ai-pipeline.md §3, §6), plus replay-validation of stored history (§8).
 */
import { fail } from '@shared/result'
import type { ApiMessage, ChatTurnInput } from '@shared/ai/types'
import { AiCallError } from '../errors'
import { stableStringify } from '../json'
import type { ContentBlockParam, MessageParam } from '../sdk'
import { pngBlock, textBlock } from '../calls/deps'

export interface TurnContext {
  deckOutline: unknown
  selectedSlideJson?: unknown
  /** Full slide JSON for slides with a region on them (excluding the selected one). */
  regionSlides: unknown[]
}

const bbox = (b: { x: number; y: number; w: number; h: number }): string =>
  `x ${Math.round(b.x)}, y ${Math.round(b.y)}, w ${Math.round(b.w)}, h ${Math.round(b.h)}`

/** The new user message. The teacher's own words come last so they are the freshest thing in context. */
export function buildUserMessage(input: ChatTurnInput, ctx: TurnContext): ApiMessage {
  const content: ContentBlockParam[] = [
    textBlock(`Deck outline (JSON):\n${stableStringify(ctx.deckOutline)}`)
  ]
  if (ctx.selectedSlideJson !== undefined) {
    content.push(textBlock(`Selected slide (JSON):\n${stableStringify(ctx.selectedSlideJson)}`))
  }
  for (const slide of ctx.regionSlides) {
    content.push(textBlock(`Slide with a circled region (JSON):\n${stableStringify(slide)}`))
  }
  for (const region of input.regions ?? []) {
    content.push(
      pngBlock(region.annotatedPng),
      pngBlock(region.cropPng),
      textBlock(
        `Region ${region.n} on slide ${region.slideNumber} (id ${region.slideId}) targets elements: ${region.targetElementIds.join(', ') || '(none)'}. Region bbox: ${bbox(region.bbox)}. The first image is the whole slide with the loop drawn on it; the second is a close crop.`
      )
    )
  }
  if (input.attachments?.length) {
    content.push(
      textBlock(
        `Attached files: ${input.attachments.map((a) => `${a.name} (${a.kind})`).join(', ')}`
      )
    )
  }
  content.push(textBlock(input.text))
  return { role: 'user', content }
}

/** Validates stored history: it must be `ApiMessage[]`. Anything else cannot be replayed safely. */
export function parseHistory(history: unknown[]): ApiMessage[] {
  return history.map((entry) => {
    const message = entry as Partial<ApiMessage> | null
    const valid =
      message !== null &&
      typeof message === 'object' &&
      (message.role === 'user' || message.role === 'assistant') &&
      Array.isArray(message.content)
    if (!valid) throw new AiCallError(fail('invalid-input', 'The chat history could not be read.'))
    return message as ApiMessage
  })
}

/** Stored messages as SDK params. Content is passed through untouched (thinking blocks included). */
export const toParams = (messages: ApiMessage[]): MessageParam[] =>
  messages as unknown as MessageParam[]
