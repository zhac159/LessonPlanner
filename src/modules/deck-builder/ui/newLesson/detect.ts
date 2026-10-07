/**
 * Local guesses (no AI) from the typed objectives (05 §8.2): a year group ("Y8", "Year 8", "yr 8") and a
 * lesson length ("50 minutes", "50 min"). Everything else is left to `extractObjectives` in main.
 */
import { YEAR_GROUPS } from './setup'

const YEAR_RE = /(?<![A-Za-z])(?:year|yr|y)\s?(\d{1,2})(?!\d)/i
const MINUTES_RE = /(?<!\d)(\d{2,3})\s?(?:minutes?|mins?)(?![A-Za-z])/i

const MIN_LENGTH = 15
const MAX_LENGTH = 180

/** "Year 8" from free text, or null. Only Years 7 to 13 count. */
export function detectYearGroup(text: string): string | null {
  const year = Number(YEAR_RE.exec(text)?.[1])
  return year >= 7 && year <= 13 ? `Year ${year}` : null
}

/** A year group from a document ("Y8", "8", "Year 8", "Form time") in the chip's own spelling, or null. */
export function normaliseYearGroup(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim()
  if (!text) return null
  const exact = YEAR_GROUPS.find((g) => g.toLowerCase() === text.toLowerCase())
  if (exact) return exact
  if (/^form( time)?$/i.test(text)) return 'Form time'
  return detectYearGroup(text) ?? detectYearGroup(`Year ${text}`)
}

/** The lesson length in minutes from free text, or null. */
export function detectDuration(text: string): number | null {
  const minutes = Number(MINUTES_RE.exec(text)?.[1])
  return minutes >= MIN_LENGTH && minutes <= MAX_LENGTH ? minutes : null
}
