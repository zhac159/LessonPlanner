/** Test-only builders for the chat, generation and plugin services: a lessons rig plus recorded events. */
import type { Usage } from '@shared/ai/types'
import type { AiService } from '@shared/ai/types'
import type { DeckBuilderEvents } from '@shared/contracts/deck-builder'
import { fixtureDeck } from '@shared/deck/testing'
import { createFakeAiService, type FakeAiOptions } from '../../ai/fake'
import { makeRig, seedLesson, type Rig } from '../lessons/testing'
import type { LessonsServiceDeps } from '../lessons/types'
import { ChatStore } from './store'

export interface RecordedEvent {
  name: keyof DeckBuilderEvents
  payload: unknown
}

export interface ServicesRig extends Rig {
  lessonId: string
  store: ChatStore
  /** Every event except `lessonsChanged`, in order. */
  events: RecordedEvent[]
  emit: <K extends keyof DeckBuilderEvents>(name: K, payload: DeckBuilderEvents[K]) => void
  /** Payloads of one event. */
  of(name: keyof DeckBuilderEvents): unknown[]
  /** Event names in order (without `lessonsChanged`). */
  names(): string[]
  ai: AiService
}

/** A lesson (the photosynthesis fixture, 3 slides) with the fake AI and an event recorder. */
export async function makeServicesRig(
  options: {
    ai?: Partial<AiService>
    fake?: FakeAiOptions
    lessons?: Partial<LessonsServiceDeps>
  } = {}
): Promise<ServicesRig> {
  const rig = makeRig(options.lessons)
  const lessonId = await seedLesson(rig, fixtureDeck())
  await rig.service.flushThumbnails()
  const events: RecordedEvent[] = []
  const emit: ServicesRig['emit'] = (name, payload) => {
    if (name !== 'lessonsChanged') events.push({ name, payload })
  }
  const ai: AiService = { ...createFakeAiService(options.fake), ...options.ai }
  return {
    ...rig,
    lessonId,
    store: new ChatStore((id) => rig.service.chatPath(id)),
    events,
    emit,
    of: (name) => events.filter((e) => e.name === name).map((e) => e.payload),
    names: () => events.map((e) => e.name),
    ai
  }
}

export const USAGE: Usage = {
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 0,
  cacheWriteTokens: 0
}
