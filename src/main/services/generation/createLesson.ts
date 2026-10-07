/**
 * `deck-builder:createLesson` (05 §6): makes the lesson, moves the attached documents into it and, for "Make my
 * slides", starts the generation. "Blank slide" starts with one empty title slide instead.
 */
import type { CreateLessonRequest } from '@shared/contracts/deck-builder'
import { fail, ok, type Result } from '@shared/result'
import type { LessonsService } from '../lessons/service'
import { NO_OBJECTIVES } from './planner'
import type { GenerationService } from './service'

export const MAX_DOCUMENTS = 3

/** Creates a lesson from the New lesson screen (or Home) and optionally starts generating into it. */
export async function createLessonFromRequest(
  deps: { lessons: LessonsService; generation: GenerationService },
  req: CreateLessonRequest
): Promise<Result<{ lessonId: string; jobId: string | null; messageId: string | null }>> {
  if (req.documentIds.length > MAX_DOCUMENTS)
    return fail('invalid-input', `You can attach up to ${MAX_DOCUMENTS} documents.`)
  if (req.startGeneration && !req.objectivesText.trim() && req.documentIds.length === 0)
    return fail('invalid-input', NO_OBJECTIVES)

  const created = await deps.lessons.create({
    title: req.title,
    styleId: req.styleId,
    meta: req.meta,
    blankSlide: req.blankSlide && !req.startGeneration
  })
  if (!created.ok) return created
  const { lessonId } = created
  if (!req.startGeneration) {
    await deps.lessons.files.adoptDocuments(lessonId, req.documentIds)
    return ok({ lessonId, jobId: null, messageId: null })
  }
  const started = await deps.generation.generate({
    lessonId,
    text: req.objectivesText,
    documentIds: req.documentIds,
    meta: req.meta
  })
  return started.ok ? ok({ lessonId, jobId: started.jobId, messageId: started.messageId }) : started
}
