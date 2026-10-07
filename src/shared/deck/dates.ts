/**
 * Unresolved dates (agents/ASSETS.md §5.7 defect 4): a date field that nobody filled in ("{{date}}", "[date]",
 * "DD/MM/YYYY") must never print on a slide or in the .pptx. Real dates the teacher typed are left alone. Pure.
 */

const PATTERN =
  '\\{\\{\\s*date\\s*\\}\\}|\\{\\s*date\\s*\\}|\\[\\s*date\\s*\\]|<\\s*date\\s*>|\\bdd/mm/(?:yyyy|yy)\\b|_{1,4}/_{1,4}/_{2,4}'

/**
 * `text` without unresolved date fields. Only the text around a removed field is tidied (a doubled space or a
 * space left at a line end); text without a field comes back untouched.
 */
export function stripUnresolvedDates(text: string): string {
  if (!new RegExp(PATTERN, 'i').test(text)) return text
  return text
    .replace(new RegExp(PATTERN, 'gi'), '')
    .replace(/(\S)[ \t]{2,}(?=\S)/g, '$1 ')
    .replace(/[ \t]+$/gm, '')
    .replace(/^[ \t]+/, '')
}
