/**
 * The first two stages of a generation: read the objectives (`extractObjectives`) and plan the lesson
 * (`planLesson`), with the plan validated as the spec asks (ai-pipeline.md §4.5): every objective covered, every
 * `layoutId` in the style, the slide count within 2 of the target.
 */
import type { AiService, ExtractedObjectives, LessonBrief, LessonPlan } from '@shared/ai/types'
import type { LessonMeta } from '@shared/deck/types'
import { fail, ok, type Result } from '@shared/result'
import type { StyleProfile } from '@shared/style/types'
import { planProblems, repairLayouts } from '../../ai/calls/planRules'
import type { DocumentReader } from './documents'

export interface BriefInput {
  lessonId: string
  /** The Composer text. */
  text: string
  documentIds: readonly string[]
  meta: Partial<LessonMeta>
  /** The lesson's title when the teacher set it (it is never overwritten). */
  typedTitle?: string
}

const unique = (items: readonly string[]): string[] => [
  ...new Set(items.map((s) => s.trim()).filter(Boolean))
]

/** Merges what the typed text and each document say into one brief; the teacher's own set-up wins. */
export function mergeBrief(
  input: BriefInput,
  extractions: readonly ExtractedObjectives[]
): LessonBrief {
  const first = (pick: (e: ExtractedObjectives) => string | undefined): string | undefined =>
    extractions.map(pick).find((v) => v?.trim())
  const objectives = unique(extractions.flatMap((e) => e.objectives))
  const context = unique([input.meta.context ?? '', ...extractions.map((e) => e.context ?? '')])
  const brief: LessonBrief = {
    objectives: objectives.length > 0 ? objectives : unique([input.text.split('\n')[0] ?? ''])
  }
  const title = input.typedTitle ?? first((e) => e.title)
  const subject = input.meta.subject ?? first((e) => e.subject)
  const yearGroup = input.meta.yearGroup ?? first((e) => e.yearGroup)
  if (title) brief.title = title
  if (subject) brief.subject = subject
  if (yearGroup) brief.yearGroup = yearGroup
  if (input.meta.durationMin) brief.durationMin = input.meta.durationMin
  if (input.meta.ability) brief.ability = input.meta.ability
  if (input.meta.targetSlideCount) brief.targetSlideCount = input.meta.targetSlideCount
  if (context.length > 0) brief.context = context.join('\n')
  return brief
}

export const NO_OBJECTIVES = 'Add your learning objectives, or attach a document, first.'

/** Reads the typed text and every attached document, then merges them. */
export async function makeBrief(
  deps: { ai: AiService; documents: DocumentReader },
  input: BriefInput,
  signal: AbortSignal
): Promise<Result<{ brief: LessonBrief }>> {
  const reads = await Promise.all([
    ...(input.text.trim() ? [deps.ai.extractObjectives({ text: input.text }, { signal })] : []),
    ...input.documentIds.map((id) => deps.documents.read(id, input.lessonId, { signal }))
  ])
  const failed = reads.find((r) => !r.ok)
  if (failed && !failed.ok) return failed
  const extractions = reads.flatMap((r) => (r.ok ? [r.extracted] : []))
  if (extractions.length === 0) return fail('invalid-input', NO_OBJECTIVES)
  return ok({ brief: mergeBrief(input, extractions) })
}

export const PLAN_FAILED = 'I couldn’t plan that lesson cleanly. Nothing was changed. Try again.'

/**
 * Plans the lesson. A plan with problems gets its layouts repaired, then ONE more attempt that is told the
 * problems; if it is still not valid the generation stops before any slide is written.
 */
export async function makePlan(
  ai: AiService,
  profile: StyleProfile | null,
  brief: LessonBrief,
  signal: AbortSignal,
  onProgress: (message: string) => void
): Promise<Result<{ plan: LessonPlan }>> {
  let current = brief
  for (let attempt = 0; attempt < 2; attempt++) {
    const planned = await ai.planLesson({ profile, brief: current }, { signal, onProgress })
    if (!planned.ok) return planned
    const plan = repairLayouts(planned.plan, profile)
    const problems = planProblems(plan, brief, profile)
    if (problems.length === 0) return ok({ plan })
    onProgress('Tidying the plan…')
    current = {
      ...brief,
      context: [brief.context, `Fix these problems with the plan:\n- ${problems.join('\n- ')}`]
        .filter(Boolean)
        .join('\n\n')
    }
  }
  return fail('unknown', PLAN_FAILED)
}
