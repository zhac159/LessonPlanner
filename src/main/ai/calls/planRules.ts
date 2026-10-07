/**
 * Pure rules about a lesson plan. Kept apart from lesson.ts (which needs the Claude request layer) so the
 * fake AI and the generation service can use them without loading the Anthropic SDK at startup.
 */
import type { LessonBrief, LessonPlan } from '@shared/ai/types'
import type { SlideKind } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'

/** The layout that serves `kind` best (the profile's own choice, else its first layout), or '' with no profile. */
export function layoutFor(kind: SlideKind, profile: StyleProfile | null): string {
  if (!profile || profile.layouts.length === 0) return ''
  return (profile.layouts.find((l) => l.usedFor.includes(kind)) ?? profile.layouts[0]).id
}

/** What is wrong with a plan (empty = fine): uncovered objectives, unknown layouts, slide count out of range. */
export function planProblems(
  plan: LessonPlan,
  brief: LessonBrief,
  profile: StyleProfile | null
): string[] {
  const problems: string[] = []
  const covered = new Set(plan.slides.flatMap((s) => s.objectiveRefs))
  brief.objectives.forEach((objective, i) => {
    if (!covered.has(i))
      problems.push(`Objective ${i} ("${objective}") is not covered by any slide.`)
  })
  // A style learned without any layouts (the synthesis can return none) has nothing to be checked against:
  // demanding a known layout id would fail every plan, however often Claude is asked again.
  if (profile && profile.layouts.length > 0) {
    const known = new Set(profile.layouts.map((l) => l.id))
    plan.slides.forEach((slide, i) => {
      if (!known.has(slide.layoutId)) {
        problems.push(
          `Slide ${i + 1} uses layoutId "${slide.layoutId}", which is not in the style profile.`
        )
      }
    })
  }
  const target = brief.targetSlideCount
  if (target && Math.abs(plan.slides.length - target) > 2) {
    problems.push(
      `The plan has ${plan.slides.length} slides but the target is ${target} (stay within 2).`
    )
  }
  return problems
}

/** Replaces layout ids the profile does not have with the best layout for each slide's kind. */
export function repairLayouts(plan: LessonPlan, profile: StyleProfile | null): LessonPlan {
  const known = new Set(profile?.layouts.map((l) => l.id))
  return {
    ...plan,
    slides: plan.slides.map((slide) => ({
      ...slide,
      layoutId:
        !profile || known.has(slide.layoutId) ? slide.layoutId : layoutFor(slide.kind, profile)
    }))
  }
}
