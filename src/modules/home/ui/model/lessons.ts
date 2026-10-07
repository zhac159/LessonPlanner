import type { LessonSummary } from '@shared/contracts/deck-builder'
import type { HomeSort } from '@shared/contracts/settings'
import { matchesQuery } from './search'

/** The "All" filter chip's value; real year groups are never this string. */
export const ALL_YEARS = 'all'

const YEAR_PATTERN = /^year\s*(\d{1,2})$/i
const FORM_PATTERN = /^form\b/i

/** Year 7…13 → 7…13, Form time → 100, any other label → 200, no year group → 300. */
function yearRank(yearGroup: string | null): number {
  const label = yearGroup?.trim()
  if (!label) return 300
  const year = YEAR_PATTERN.exec(label)
  if (year) return Number(year[1])
  if (FORM_PATTERN.test(label)) return 100
  return 200
}

const byNewest = (a: LessonSummary, b: LessonSummary): number =>
  b.updatedAt.localeCompare(a.updatedAt)

const compareYears = (a: string, b: string): number =>
  yearRank(a) - yearRank(b) || a.localeCompare(b, 'en-GB', { numeric: true })

/** The year groups present in the lessons, ordered Year 7…13, Form time, then others A–Z. */
export function yearGroups(lessons: ReadonlyArray<LessonSummary>): string[] {
  const groups = new Set<string>()
  for (const lesson of lessons) {
    const label = lesson.yearGroup?.trim()
    if (label) groups.add(label)
  }
  return [...groups].sort(compareYears)
}

/** The selected year filter, or "All" when that group no longer exists in the lessons. */
export function effectiveYear(year: string, groups: ReadonlyArray<string>): string {
  return groups.includes(year) ? year : ALL_YEARS
}

/** Search (title and year group) stacked with the year filter. */
export function filterLessons(
  lessons: ReadonlyArray<LessonSummary>,
  { query, year }: { query: string; year: string }
): LessonSummary[] {
  return lessons.filter(
    (lesson) =>
      (year === ALL_YEARS || lesson.yearGroup?.trim() === year) &&
      matchesQuery(query, [lesson.title, lesson.yearGroup, lesson.yearShort])
  )
}

/**
 * Orders lessons: "Last edited" is newest first (a lesson still generating leads), "Title A–Z" is a
 * numeric-aware en-GB compare, "Year group" is Year 7…13, Form time, others, then newest first.
 */
export function sortLessons(
  lessons: ReadonlyArray<LessonSummary>,
  sort: HomeSort
): LessonSummary[] {
  const list = [...lessons]
  if (sort === 'title') {
    return list.sort(
      (a, b) => a.title.localeCompare(b.title, 'en-GB', { numeric: true }) || byNewest(a, b)
    )
  }
  if (sort === 'year') {
    return list.sort(
      (a, b) =>
        yearRank(a.yearGroup) - yearRank(b.yearGroup) || compareLabels(a, b) || byNewest(a, b)
    )
  }
  const generating = (lesson: LessonSummary): number => (lesson.status === 'generating' ? 0 : 1)
  return list.sort((a, b) => generating(a) - generating(b) || byNewest(a, b))
}

/** Within "other" labels (rank 200) keep A–Z so the order is stable. */
function compareLabels(a: LessonSummary, b: LessonSummary): number {
  return (a.yearGroup ?? '').localeCompare(b.yearGroup ?? '', 'en-GB', { numeric: true })
}

/** What the Past lessons area shows when the list is empty. */
export type LessonsEmpty =
  | { kind: 'none' }
  | { kind: 'no-lessons' }
  | { kind: 'no-match'; query: string }
  | { kind: 'no-year'; year: string }

/** Chooses the empty state: nothing saved, nothing matching the search, or nothing in that year. */
export function emptyKind(args: {
  total: number
  shown: number
  query: string
  year: string
}): LessonsEmpty {
  if (args.shown > 0) return { kind: 'none' }
  if (args.total === 0) return { kind: 'no-lessons' }
  if (args.query.trim()) return { kind: 'no-match', query: args.query.trim() }
  return { kind: 'no-year', year: args.year }
}
