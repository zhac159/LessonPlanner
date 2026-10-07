/** Time-of-day word for the Home greeting: morning 05:00–11:59, afternoon 12:00–17:59, else evening. */
export function partOfDay(now: Date): 'morning' | 'afternoon' | 'evening' {
  const hour = now.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  return 'evening'
}

/** "Good morning, Alice!" (or "Good morning!" when there is no name yet). */
export function greetingFor(now: Date, name?: string | null): string {
  const who = name?.trim()
  return `Good ${partOfDay(now)}${who ? `, ${who}` : ''}!`
}
