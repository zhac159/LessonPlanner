import { describe, expect, it } from 'vitest'
import { formatRelativeDate } from './formatRelativeDate'

/** Local-time noon `days` calendar days before 15 June 2026 (a Monday). */
const NOW = new Date(2026, 5, 15, 9, 30)
const daysAgo = (days: number, hour = 12): string =>
  new Date(2026, 5, 15 - days, hour, 0).toISOString()

describe('formatRelativeDate', () => {
  it.each([
    [0, 'Today'],
    [1, 'Yesterday'],
    [2, '2 days ago'],
    [6, '6 days ago'],
    [7, 'Last week'],
    [13, 'Last week'],
    [14, '2 weeks ago'],
    [20, '2 weeks ago'],
    [21, '3 weeks ago'],
    [27, '3 weeks ago'],
    [28, 'Last month'],
    [59, 'Last month'],
    [60, '2 months ago'],
    [89, '2 months ago'],
    [90, '3 months ago'],
    [364, '12 months ago']
  ])('%i days ago reads "%s"', (days, text) => {
    expect(formatRelativeDate(daysAgo(days), NOW)).toBe(text)
  })

  it('shows an en-GB date from 365 days', () => {
    expect(formatRelativeDate(new Date(2025, 2, 4, 10).toISOString(), NOW)).toBe('4 March 2025')
    expect(formatRelativeDate(daysAgo(365), NOW)).toMatch(/^\d{1,2} \w+ 2025$/)
  })

  it('counts calendar days, not 24-hour periods', () => {
    const lateLastNight = new Date(2026, 5, 14, 23, 50).toISOString()
    expect(formatRelativeDate(lateLastNight, new Date(2026, 5, 15, 0, 10))).toBe('Yesterday')
    const earlyToday = new Date(2026, 5, 15, 0, 5).toISOString()
    expect(formatRelativeDate(earlyToday, new Date(2026, 5, 15, 23, 55))).toBe('Today')
  })

  it('is stable across the clocks changing', () => {
    // UK clocks go forward on 29 March 2026: 28 March 12:00 is still "Yesterday" on the 29th.
    const before = new Date(2026, 2, 28, 12).toISOString()
    expect(formatRelativeDate(before, new Date(2026, 2, 29, 12))).toBe('Yesterday')
  })

  it('treats the future as today', () => {
    expect(formatRelativeDate(daysAgo(-3), NOW)).toBe('Today')
  })

  it('returns an empty string for an unreadable timestamp', () => {
    expect(formatRelativeDate('not a date', NOW)).toBe('')
    expect(formatRelativeDate('', NOW)).toBe('')
  })

  it('uses the current time when no "now" is given', () => {
    expect(formatRelativeDate(new Date().toISOString())).toBe('Today')
  })
})
