/** Pure helpers for rendering paragraphs (list numbering, callout labels). */
import type { Paragraph } from '@shared/deck/types'

const MAX_LEVEL = 2

/** True for bullet, number and checkbox paragraphs. */
export const isList = (p: Paragraph): boolean => p.list !== undefined && p.list !== 'none'

/** True when every paragraph is a list item (then the box is exposed as a list). */
export const isListOnly = (paragraphs: readonly Paragraph[]): boolean =>
  paragraphs.length > 0 && paragraphs.every(isList)

/**
 * Number shown for each paragraph (`null` for non-numbered ones). Numbering counts consecutive numbered
 * paragraphs per indent level; a paragraph at level L restarts the counters of every deeper level, and a
 * non-numbered paragraph at level L restarts level L too.
 */
export function listNumbers(paragraphs: readonly Paragraph[]): Array<number | null> {
  const counters = [0, 0, 0]
  return paragraphs.map((p) => {
    const level = Math.min(p.level ?? 0, MAX_LEVEL)
    for (let deeper = level + 1; deeper <= MAX_LEVEL; deeper++) counters[deeper] = 0
    if (p.list !== 'number') {
      counters[level] = 0
      return null
    }
    counters[level] += 1
    return counters[level]
  })
}

/** Bullet glyph per indent level. */
export const BULLETS = ['•', '◦', '▪'] as const

/** Prepends a bold label ("Mini-whiteboards:") to the first paragraph (or makes one when there is none). */
export function withLabel(
  paragraphs: readonly Paragraph[],
  label: string | undefined
): Paragraph[] {
  if (!label) return [...paragraphs]
  const labelRun = { text: label, bold: true }
  const [first, ...rest] = paragraphs
  if (!first) return [{ runs: [labelRun] }]
  return [{ ...first, runs: [labelRun, { text: ' ' }, ...first.runs] }, ...rest]
}
