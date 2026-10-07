/**
 * One line of `lessons/<id>/chat.jsonl` (design/ai-pipeline.md §8): append-only, one record per message.
 * `ui` is what the ChatPanel shows; `api` holds the exact Claude messages of the turn, replayed verbatim.
 */
import { z } from 'zod'
import type { Usage } from '@shared/ai/types'
import type { ChatAssetRef } from '@shared/assets/types'
import type { AttachmentRef, ChatItem, ChatRegion } from '@shared/contracts/deck-builder-chat'

const documentKind = z.enum(['docx', 'pdf', 'pptx'])

const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['docx', 'pdf', 'pptx', 'image']),
  sizeBytes: z.number()
})

const regionSchema = z.object({
  n: z.number(),
  slideId: z.string(),
  slideNumber: z.number(),
  path: z.array(z.tuple([z.number(), z.number()])),
  caption: z.string()
})

const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  action: z.enum(['retry', 'settings', 'console', 'finish']).optional()
})

/** An asset named by a `{{name}}` token, pinned to its id so a rename or delete never breaks the message. */
const assetRefSchema = z.object({ assetId: z.string(), name: z.string() })

const usageSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadTokens: z.number(),
  cacheWriteTokens: z.number()
})

export const chatRecordSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  at: z.string(),
  ui: z.object({
    text: z.string(),
    attachments: z.array(attachmentSchema).optional(),
    regions: z.array(regionSchema).optional(),
    /** The ChangeSets this message made, in order (labels and Undo state are derived from the journal). */
    changeSetIds: z.array(z.string()).optional(),
    pluginId: z.string().optional(),
    assets: z.array(assetRefSchema).optional(),
    showSpots: z.boolean().optional(),
    file: z.object({ name: z.string(), path: z.string(), kind: documentKind }).optional(),
    error: errorSchema.optional()
  }),
  api: z.array(z.unknown()),
  usage: usageSchema.optional()
})

export interface ChatRecord {
  id: string
  role: 'user' | 'assistant'
  at: string
  ui: {
    text: string
    attachments?: AttachmentRef[]
    regions?: ChatRegion[]
    changeSetIds?: string[]
    pluginId?: string
    assets?: ChatAssetRef[]
    showSpots?: boolean
    file?: NonNullable<ChatItem['file']>
    error?: NonNullable<ChatItem['error']>
  }
  /** Claude messages (content blocks verbatim) this record added to the conversation. */
  api: unknown[]
  usage?: Usage
}

/** The parsed record, or undefined when the line is not a valid record. */
export function parseChatRecord(value: unknown): ChatRecord | undefined {
  const parsed = chatRecordSchema.safeParse(value)
  return parsed.success ? (parsed.data as ChatRecord) : undefined
}
