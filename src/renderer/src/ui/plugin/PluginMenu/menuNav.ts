/** Tiles per row of the menu grid. */
export const MENU_COLUMNS = 2

/** Rows of tile indices: each group of `size` tiles is laid out `MENU_COLUMNS` to a row. */
export function menuRows(groupSizes: number[]): number[][] {
  const rows: number[][] = []
  let next = 0
  for (const size of groupSizes) {
    for (let start = 0; start < size; start += MENU_COLUMNS) {
      const count = Math.min(MENU_COLUMNS, size - start)
      rows.push(Array.from({ length: count }, (_, i) => next + start + i))
    }
    next += size
  }
  return rows
}

/**
 * Arrow-key navigation of the "+" menu (06 §8.7). Tiles are numbered 0..n-1 in reading order and
 * the "Manage" link is item n. Left and Right move one tile; Up and Down move between rows keeping
 * the column; Up from the first row reaches Manage and Down from the last row too (Manage then
 * leads back to the first tile). Home and End jump to the first and last tile. Returns the item
 * to focus, or null when the key does not move focus.
 */
export function menuFocusTarget(key: string, index: number, groupSizes: number[]): number | null {
  const rows = menuRows(groupSizes)
  const tiles = rows.reduce((sum, row) => sum + row.length, 0)
  const manage = tiles
  if (tiles === 0) return null
  const onManage = index === manage
  const rowAt = rows.findIndex((row) => row.includes(index))
  const column = rowAt >= 0 ? rows[rowAt].indexOf(index) : 0

  switch (key) {
    case 'ArrowRight':
      return onManage || index === tiles - 1 ? null : index + 1
    case 'ArrowLeft':
      return onManage || index === 0 ? null : index - 1
    case 'ArrowDown': {
      if (onManage) return 0
      const next = rows[rowAt + 1]
      return next ? next[Math.min(column, next.length - 1)] : manage
    }
    case 'ArrowUp': {
      if (onManage) return tiles - 1
      const previous = rows[rowAt - 1]
      return previous ? previous[Math.min(column, previous.length - 1)] : manage
    }
    case 'Home':
      return 0
    case 'End':
      return tiles - 1
    default:
      return null
  }
}

/**
 * Type-ahead: the first item after `from` (wrapping) whose label starts with `buffer`. A buffer of
 * one repeated character cycles through the items starting with it. -1 when nothing matches.
 */
export function typeaheadMatch(labels: string[], buffer: string, from: number): number {
  const needle = buffer.toLowerCase()
  if (!needle) return -1
  const cycling = needle.length > 1 && [...needle].every((c) => c === needle[0])
  const prefix = cycling ? needle[0] : needle
  const start = needle.length === 1 || cycling ? from + 1 : from
  for (let offset = 0; offset < labels.length; offset++) {
    const i = (start + offset + labels.length) % labels.length
    if (labels[i].toLowerCase().startsWith(prefix)) return i
  }
  return -1
}
