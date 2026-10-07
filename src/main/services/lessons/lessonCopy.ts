/** "Duplicate": a copy of a lesson folder with a new id, a fresh history and chat, and "(copy)" in its title. */
import { fail, ok, type Result } from '@shared/result'
import { MAX_TITLE_LENGTH } from './blank'
import type { KeyedMutex } from './mutex'
import type { LessonStore } from './store'
import { LESSON_NOT_FOUND } from './types'

/** A copy starts with a fresh history, chat, outputs and no unfinished generation. */
const SKIPPED_WHEN_COPYING = [
  'changes.jsonl',
  'chat.jsonl',
  'generation.json',
  'outputs',
  'thumb.png'
]

/** Copies lesson `lessonId` to `copyId` (same slides and pictures). */
export function copyLesson(
  deps: { store: LessonStore; mutex: KeyedMutex; clock: () => Date },
  lessonId: string,
  copyId: string
): Promise<Result> {
  const { store } = deps
  return deps.mutex.run(lessonId, async (): Promise<Result> => {
    const read = await store.readDeck(lessonId)
    if (!read.ok) return fail('not-found', LESSON_NOT_FOUND)
    const now = deps.clock().toISOString()
    const title = `${read.deck.title} (copy)`.slice(0, MAX_TITLE_LENGTH)
    try {
      await store.copyFolder(lessonId, copyId, SKIPPED_WHEN_COPYING)
      await store.writeDeck(copyId, {
        ...read.deck,
        id: copyId,
        title,
        createdAt: now,
        updatedAt: now
      })
      const sidecar = await store.readSidecar(lessonId)
      await store.writeSidecar(copyId, { ...sidecar, titleSource: 'user' })
    } catch (error) {
      return fail('io', `The lesson could not be copied: ${String(error)}`)
    }
    return ok()
  })
}
