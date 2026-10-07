/** Whole calendar days between two instants, in local time (so 23:50 yesterday is 1 day ago at 00:10). */
function calendarDaysBetween(then: Date, now: Date): number {
  const start = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())
  const end = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((end - start) / 86_400_000)
}

const plural = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 's'} ago`

/**
 * Relative date for Home and Styles (design/screens/README.md "Relative dates"). Local time, calendar
 * days: "Today", "Yesterday", "3 days ago", "Last week", "2 weeks ago", "Last month", "5 months ago",
 * then an en-GB date such as "4 March 2025". Future timestamps count as "Today"; an unparseable
 * `iso` gives an empty string.
 */
export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const days = Math.max(0, calendarDaysBetween(then, now))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'Last week'
  if (days < 28) return plural(Math.floor(days / 7), 'week')
  if (days < 60) return 'Last month'
  if (days < 365) return plural(Math.floor(days / 30), 'month')
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
