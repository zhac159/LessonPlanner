/** The `LessonsApi` half of the deck-builder contract (03 Home, 05 New lesson): thin calls into the services. */
import type { ContractImpl } from '@shared/contract'
import type { LessonsApi } from '@shared/contracts/deck-builder'
import { createLessonFromRequest } from '@main/services/generation'
import type { DeckBuilderServices } from '@main/services/deckBuilder/services'
import { ok } from '@shared/result'

/** Implements lists, LO documents, create, generate, duplicate, rename, delete and restore. */
export function createLessonsApi(s: DeckBuilderServices): ContractImpl<LessonsApi> {
  /** A freshly attached document is read in the background; the card learns about it from `documentRead`. */
  const announced = <T extends { ok: boolean }>(result: T): T => {
    const document = (result as { document?: { id: string } }).document
    if (result.ok && document) void s.generation.documents.announce(document.id)
    return result
  }
  return {
    listLessons: () => s.lessons.list(),
    pickLoDocument: async () => announced(await s.lessons.files.pickLoDocument()),
    importLoDocument: async ({ path }) => announced(await s.lessons.files.importLoDocument(path)),
    createLesson: (req) =>
      createLessonFromRequest({ lessons: s.lessons, generation: s.generation }, req),
    generate: (args) => s.generation.generate(args),
    finishGeneration: ({ lessonId }) => s.generation.finish(lessonId),
    cancel: ({ jobId }) => {
      s.generation.cancel(jobId)
    },
    duplicateLesson: ({ lessonId }) => s.lessons.duplicate(lessonId),
    renameLesson: ({ lessonId, title }) => s.lessons.rename(lessonId, title),
    deleteLesson: ({ lessonId }) => s.lessons.delete(lessonId),
    restoreLesson: async ({ lessonId }) => {
      const restored = await s.lessons.undoDelete(lessonId)
      return restored.ok ? ok() : restored
    }
  }
}
