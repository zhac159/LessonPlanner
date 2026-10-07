/** Pure keyboard-navigation helpers for a vertical menu. Disabled items are skipped. */

export interface NavItem {
  label: string
  disabled?: boolean
}

/** Index of the next enabled item after `from`, wrapping round; -1 when none is enabled. */
export function nextEnabled(items: ReadonlyArray<NavItem>, from: number, step: 1 | -1): number {
  const n = items.length
  for (let i = 1; i <= n; i++) {
    const index = (((from + step * i) % n) + n) % n
    if (!items[index]!.disabled) return index
  }
  return -1
}

/** First enabled index, or -1. */
export function firstEnabled(items: ReadonlyArray<NavItem>): number {
  return items.findIndex((item) => !item.disabled)
}

/** Last enabled index, or -1. */
export function lastEnabled(items: ReadonlyArray<NavItem>): number {
  return items.findLastIndex((item) => !item.disabled)
}

/**
 * Type-ahead: the next enabled item (after `from`, wrapping) whose label starts with `query`.
 * Repeating one letter cycles through items that share it.
 */
export function matchTypeahead(items: ReadonlyArray<NavItem>, from: number, query: string): number {
  const q = query.toLowerCase()
  if (!q) return -1
  const n = items.length
  const repeated = [...q].every((c) => c === q[0])
  const needle = repeated ? q[0]! : q
  const start = repeated ? from + 1 : from
  for (let i = 0; i < n; i++) {
    const index = (((start + i) % n) + n) % n
    const item = items[index]!
    if (!item.disabled && item.label.toLowerCase().startsWith(needle)) return index
  }
  return -1
}
