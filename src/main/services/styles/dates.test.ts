import { describe, expect, it } from 'vitest'
import { hasDate, stripDates, stripDatesFromList, WEEKDAY_PATTERN } from './dates'

describe('stripDates', () => {
  it.each([
    ['Monday 5th October 2026 - LO: To infer meaning', 'LO: To infer meaning'],
    ['Wednesday 7th October', ''],
    ['Today is Monday 3 March', 'Today is'],
    ['Lesson on 3rd of March 2025 about plurals', 'Lesson about plurals'],
    ['March 14, 2025', ''],
    ['Date: 12/03/2026', ''],
    ['Handed in on Fri 4.10.26', 'Handed in'],
    ['October 2026', '']
  ])('"%s" -> "%s"', (input, expected) => {
    expect(stripDates(input)).toBe(expected)
  })

  it('keeps the colon of a kicker that carried a date', () => {
    expect(stripDates('Input: Monday 5th October 2026')).toBe('Input:')
  })

  it('leaves text without a date untouched, including words that look like months or days', () => {
    for (const text of [
      'Starter/Do Now: find the nouns',
      'Monday',
      'You may begin',
      'Date written in full with superscript ordinal as the title',
      'Page 12 of 14',
      'Steps to success: 3 things'
    ]) {
      expect(hasDate(text)).toBe(false)
      expect(stripDates(text)).toBe(text)
    }
  })

  it('drops list entries that were only a date and cleans the rest', () => {
    const cleaned = stripDatesFromList([
      'Wednesday 7th October 2026',
      'Input:',
      'LO: To spell, 5 March'
    ])
    expect(cleaned).toEqual(['Input:', 'LO: To spell'])
    expect(cleaned.join(' ')).not.toMatch(WEEKDAY_PATTERN)
  })
})
