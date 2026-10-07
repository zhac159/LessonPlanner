/**
 * Cleans one file analysis before anything is learned from it (agents/ASSETS.md §5.7, defects 4 and "scheme plan"):
 *  - a page that is the published scheme's own plan or reference sheet ("Writing Root session plan") is a SOURCE PLAN,
 *    not one of her slides: it leaves the slide kinds (it was counted as a `custom` slide kind), the exemplar candidates
 *    and the layouts, and its page number is returned so the picture facts skip it too;
 *  - literal dates ("Monday 5th October 2026") leave every text field.
 * Idempotent: cleaning a cleaned analysis changes nothing.
 */
import type { FileAnalysis } from '@shared/ai/types'
import { stripDates, stripDatesFromList } from './dates'

const PLAN_TITLE =
  /\b(source plan|scheme|session plan|planning (?:page|sheet|overview)|reference sheet|published|overview of the (?:unit|scheme))\b/i
const PLAN_PROBLEM = /page\s+(\d+)\b[^.;]*?\b(plan|scheme|reference|published|not one of her)/gi

/** Pages of the file that are a source plan, from the model's own notes (titles, problems). */
export function sourcePlanPages(analysis: FileAnalysis): number[] {
  const pages = new Set<number>()
  for (const entry of analysis.slideKinds)
    if (entry.kind === 'custom' && PLAN_TITLE.test(entry.title ?? '')) pages.add(entry.page)
  for (const problem of analysis.problems ?? []) {
    for (const match of problem.matchAll(PLAN_PROBLEM)) pages.add(Number(match[1]))
  }
  return [...pages].sort((a, b) => a - b)
}

export interface CleanedAnalysis {
  analysis: FileAnalysis
  /** Source-plan pages found now (the caller merges them with what it already knew). */
  planPages: number[]
}

export function cleanFileAnalysis(
  input: FileAnalysis,
  knownPlanPages: readonly number[] = []
): CleanedAnalysis {
  const plan = new Set([...knownPlanPages, ...sourcePlanPages(input)])
  const keep = (page: number): boolean => !plan.has(page)
  const analysis: FileAnalysis = {
    ...input,
    slideKinds: input.slideKinds
      .filter((entry) => keep(entry.page))
      .map((entry) => (entry.title ? { ...entry, title: stripDates(entry.title) } : entry)),
    exemplarCandidates: input.exemplarCandidates
      .filter((entry) => keep(entry.page))
      .map((entry) => ({ ...entry, why: stripDates(entry.why) })),
    layouts: input.layouts.map((layout) => ({
      ...layout,
      pages: layout.pages.filter(keep),
      description: stripDates(layout.description)
    })),
    voice: {
      ...input.voice,
      rules: stripDatesFromList(input.voice.rules),
      phrases: stripDatesFromList(input.voice.phrases)
    },
    habits: stripDatesFromList(input.habits),
    ...(input.problems ? { problems: stripDatesFromList(input.problems) } : {})
  }
  return { analysis, planPages: [...plan].sort((a, b) => a - b) }
}
