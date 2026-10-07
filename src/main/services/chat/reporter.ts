/** How a chat turn is written down and announced: the stored messages and the events that end a turn. */
import { isRetryable } from '@shared/ai/errors'
import { EMPTY_USAGE } from '@shared/ai/prices'
import type { Usage } from '@shared/ai/types'
import type { ChatAssetRef } from '@shared/assets/types'
import type { AttachmentRef, ChatRegion } from '@shared/contracts/deck-builder-chat'
import type { SavedFile } from '@shared/plugins/types'
import type { Failure, Result } from '@shared/result'
import type { EmitEvent } from '../lessons/types'
import { errorOf, toAiErrorCode } from './errors'
import type { ChatRecord } from './records'
import type { ChatStore } from './store'

export type TurnOutcome = Result<{ usage: Usage; apiBlocks: unknown[] }>

/** What one finished turn produced. */
export interface TurnEnd {
  lessonId: string
  messageId: string
  outcome: TurnOutcome
  /** The text streamed to the teacher. */
  reply: string
  changeSetIds: readonly string[]
  files: readonly SavedFile[]
  /** Assets the reply named with `{{name}}` (already checked against the library). */
  assets?: readonly ChatAssetRef[]
  /** The turn left picture spots: draw the SpotsCard under the message. */
  showSpots?: boolean
}

export class TurnReporter {
  constructor(
    private readonly deps: {
      store: ChatStore
      emit: EmitEvent
      clock: () => Date
      ids: (prefix: string) => string
    }
  ) {}

  /** The teacher's message as stored (attachments and circled regions travel with it). */
  userRecord(
    text: string,
    attachments: AttachmentRef[],
    regions: ChatRegion[],
    assets: readonly ChatAssetRef[] = []
  ): ChatRecord {
    return {
      id: this.deps.ids('msg'),
      role: 'user',
      at: this.deps.clock().toISOString(),
      ui: {
        text,
        ...(attachments.length ? { attachments } : {}),
        ...(regions.length ? { regions } : {}),
        ...(assets.length ? { assets: [...assets] } : {})
      },
      api: []
    }
  }

  private async save(lessonId: string, record: ChatRecord): Promise<void> {
    try {
      await this.deps.store.append(lessonId, record)
    } catch {
      // The turn already happened; losing a history line must not turn it into an error.
    }
  }

  /** Stores the assistant's message and tells the UI how the turn ended. */
  async end({
    lessonId,
    messageId,
    outcome,
    reply,
    changeSetIds,
    files,
    assets = [],
    showSpots = false
  }: TurnEnd): Promise<void> {
    const { emit } = this.deps
    const base = { id: messageId, role: 'assistant' as const, at: this.deps.clock().toISOString() }
    const ui = {
      text: reply,
      ...(changeSetIds.length ? { changeSetIds: [...changeSetIds] } : {}),
      ...(files[0] ? { file: files[0] } : {}),
      ...(assets.length ? { assets: [...assets] } : {}),
      ...(showSpots ? { showSpots: true } : {})
    }
    if (outcome.ok) {
      await this.save(lessonId, { ...base, ui, api: outcome.apiBlocks, usage: outcome.usage })
      emit('chat:done', { lessonId, messageId, usage: outcome.usage })
      return
    }
    const failure: Failure =
      outcome.code === 'cancelled' && changeSetIds.length > 0
        ? { ...outcome, message: 'Stopped. The changes already made were kept.' }
        : outcome
    await this.save(lessonId, { ...base, ui: { ...ui, error: errorOf(failure, 'chat') }, api: [] })
    if (failure.code === 'cancelled') {
      emit('chat:done', { lessonId, messageId, usage: { ...EMPTY_USAGE } })
      return
    }
    emit('ai:error', {
      scope: 'chat',
      code: toAiErrorCode(failure.code),
      message: failure.message,
      retryable: isRetryable(failure.code) || failure.code === 'invalid-input'
    })
  }
}
