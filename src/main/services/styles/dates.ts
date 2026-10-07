/**
 * Literal dates in her example decks ("Monday 5th October 2026") are facts about THAT lesson, never style: they are
 * stripped from everything learned (habits, phrases, titles, exemplars, test slide). The profile says "date slot"
 * instead: a layout region named `date` is optional and is filled only from the lesson brief (agents/ASSETS.md §5.7, 4).
 */

const MONTH =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const WEEKDAY =
  '(?:mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)'
const DAY = '\\d{1,2}(?:st|nd|rd|th)?'
const YEAR = '(?:,?\\s+(?:19|20)\\d{2})?'

/** "on Monday 3 March", "date: 3 March": the little word before a date goes with it. */
const LEAD = '(?:(?:on|dated?:?)\\s+)?'
/** Each alternative needs a day number, a month or a numeric date, so "Monday" or "may" alone never match. */
const DATE = new RegExp(
  [
    `${LEAD}(?:${WEEKDAY}\\.?,?\\s+)?${DAY}\\s+(?:of\\s+)?${MONTH}\\b\\.?${YEAR}`,
    `${LEAD}(?:${WEEKDAY}\\.?,?\\s+)?${MONTH}\\b\\.?\\s+${DAY}\\b${YEAR}`,
    `(?:${WEEKDAY}\\.?,?\\s+)?${MONTH}\\b\\.?,?\\s+(?:19|20)\\d{2}`,
    `${LEAD}(?:${WEEKDAY}\\.?,?\\s+)?\\d{1,2}[/.-]\\d{1,2}[/.-](?:\\d{4}|\\d{2})`
  ].join('|'),
  'gi'
)

/** A colon at the end stays: "Input: Monday 3 March" is her kicker "Input:", not "Input". */
const EDGE_SEPARATORS = /^[\s\-–—:,;|·/]+|[\s\-–—,;|·/]+$/g

export const hasDate = (text: string): boolean => {
  DATE.lastIndex = 0
  const found = DATE.test(text)
  DATE.lastIndex = 0
  return found
}

/** The text without literal dates; separators left dangling by the cut are trimmed. '' when nothing else was there. */
export function stripDates(text: string): string {
  if (!hasDate(text)) return text
  return text
    .replace(DATE, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(EDGE_SEPARATORS, '')
    .trim()
}

/** Strips every entry; entries that were only a date are dropped. */
export const stripDatesFromList = (items: readonly string[]): string[] =>
  items.map(stripDates).filter((item) => item !== '')

/** The names of the weekday words, for tests that check nothing is left behind. */
export const WEEKDAY_PATTERN = new RegExp(`\\b${WEEKDAY}\\b`, 'i')
