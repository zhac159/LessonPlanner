/**
 * The chat area of the `deck-builder` module: messages, circle-to-edit regions and the streaming
 * events (design/screens/06-editor.md §6, ai-pipeline.md §6 and §7). Channels are module-local and
 * keep their `chat:` prefix, so the bus key is `deck-builder:chat:send`.
 */
import type { Usage } from '../ai/types'
import type { ChatAssetRef } from '../assets/types'
import type { ChangeSet } from '../deck/types'
import type { AiErrorCode, ErrorCode, Result } from '../result'
import { keysOf } from './names'

export type DocumentKind = 'docx' | 'pdf' | 'pptx'

/** A file attached to a chat message (06 §6). */
export interface AttachmentRef {
  id: string
  name: string
  kind: DocumentKind | 'image'
  sizeBytes: number
}

/** A path in slide units (1920×1080). */
export type StrokePath = Array<[number, number]>

/** A circled region sent with a message (06 §6, ai-pipeline.md §6). */
export interface RegionDraft {
  id: string
  /** The number shown on the slide: 1, 2, 3… */
  n: number
  slideId: string
  /** Closed, simplified (RDP tolerance 4 units). */
  path: StrokePath
  bbox: { x: number; y: number; w: number; h: number }
  /** Element ids under the region, sorted by overlap. */
  targetElementIds: string[]
}

/** A region as stored with a past message. */
export interface ChatRegion {
  n: number
  slideId: string
  slideNumber: number
  path: StrokePath
  caption: string
}

/** One message in the chat panel: the UI part of chat.jsonl (06 §6, ai-pipeline.md §8). */
export interface ChatItem {
  id: string
  role: 'user' | 'assistant'
  at: string
  text: string
  attachments?: AttachmentRef[]
  regions?: ChatRegion[]
  /** The ResultChip: what changed and whether it was undone. */
  result?: { changeSetId: string; label: string; slideIds: string[]; undone: boolean }
  /** A file made by a plugin, shown as an AttachmentCard. */
  file?: { name: string; path: string; kind: DocumentKind }
  error?: { code: ErrorCode; message: string; action?: 'retry' | 'settings' | 'console' | 'finish' }
  pluginId?: string
  /** Assets named by `{{name}}` tokens in `text`, pinned to ids so renames and deletes never break old messages. */
  assets?: ChatAssetRef[]
  /** Draw the SpotsCard ("3 picture spots to fill") under this message. */
  showSpots?: boolean
}

/** A started job: listen to the chat events for `messageId`; cancel with `jobId`. */
export interface StartedJob {
  jobId: string
  messageId: string
}

export interface ChatSendArgs {
  lessonId: string
  text: string
  attachmentIds: string[]
  regions: RegionDraft[]
  /** The Draw tool's marks per slide, in slide units. */
  markup: Array<{ slideId: string; strokes: StrokePath[] }>
  selectedSlideId: string
  /** One per distinct `{{name}}` chip in `text`; main resolves by id (agents/ASSETS.md §2.5). */
  assetRefs: ChatAssetRef[]
}

export interface ChatApi {
  /** Starts a chat turn as a job (06 §6). */
  'chat:send'(args: ChatSendArgs): Result<StartedJob>
  /** Cancels a running chat job; the deck stays unchanged (06 §6). */
  'chat:cancel'(args: { jobId: string }): void
  /** Native file dialog for an attachment (06 §6). */
  'chat:attach'(args: {
    lessonId: string
  }): Result<{ attachment: AttachmentRef } | { cancelled: true }>
  /** Attaches a dropped file (06 §6). */
  'chat:attachPath'(args: { lessonId: string; path: string }): Result<{ attachment: AttachmentRef }>
}

/** Where an AI error came from, for the friendly message (ai-pipeline.md §9). */
export type AiErrorScope = 'chat' | 'generation' | 'plugin'

export interface ChatEvents {
  /** Streaming assistant text (06 §6). */
  'chat:delta': { lessonId: string; messageId: string; text: string }
  /** A progress step such as "Reading the circled area" (06 §6). */
  'chat:status': {
    lessonId: string
    messageId: string
    step: string
    state: 'running' | 'done' | 'error'
  }
  /** A committed ChangeSet to apply to the local deck and show as a ResultChip (06 §6). */
  'chat:changes': { lessonId: string; changeSet: ChangeSet }
  /** End of the turn (06 §6). */
  'chat:done': { lessonId: string; messageId: string; usage: Usage }
  /** Friendly-error trigger for chat, generation and plugin jobs (06 §6). */
  'ai:error': { scope: AiErrorScope; code: AiErrorCode; message: string; retryable: boolean }
}

export const CHAT_METHODS = keysOf<ChatApi>()([
  'chat:send',
  'chat:cancel',
  'chat:attach',
  'chat:attachPath'
])

export const CHAT_EVENTS = keysOf<ChatEvents>()([
  'chat:delta',
  'chat:status',
  'chat:changes',
  'chat:done',
  'ai:error'
])
