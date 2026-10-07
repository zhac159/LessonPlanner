import type { StyleSummary } from '@shared/contracts/style-library'
import { matchesQuery } from './search'

/** How many StyleCards "Your styles" shows before "Show all {n} styles". */
export const VISIBLE_STYLES = 3

/** Styles whose name contains the query (case- and accent-insensitive); an empty query keeps all. */
export function filterStyles(styles: ReadonlyArray<StyleSummary>, query: string): StyleSummary[] {
  return styles.filter((style) => matchesQuery(query, [style.name]))
}

/** The style a new lesson starts with: the default one, else the first, else none (plain style). */
export function defaultStyleId(styles: ReadonlyArray<StyleSummary>): string | null {
  return (styles.find((style) => style.isDefault) ?? styles[0])?.id ?? null
}

/** Default style first, then the rest by most recently updated. */
export function orderStyles(styles: ReadonlyArray<StyleSummary>): StyleSummary[] {
  return [...styles].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt.localeCompare(a.updatedAt)
  )
}

/** The meta line of a StyleCard while it is still learning: "Learning · 3 of 12 files". */
export function learningLine(style: Pick<StyleSummary, 'learning'>): string | null {
  const learning = style.learning
  return learning ? `Learning · ${learning.learned} of ${learning.total} files` : null
}
