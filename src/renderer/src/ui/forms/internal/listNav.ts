/** Index of the next enabled item from `from` in direction `step`, wrapping never; -1 if none. */
export function nextEnabled(disabled: boolean[], from: number, step: 1 | -1): number {
  for (let i = from + step; i >= 0 && i < disabled.length; i += step) {
    if (!disabled[i]) return i
  }
  return -1
}

/** First enabled index, or -1. */
export function firstEnabled(disabled: boolean[]): number {
  return disabled.findIndex((d) => !d)
}

/** Last enabled index, or -1. */
export function lastEnabled(disabled: boolean[]): number {
  return disabled.lastIndexOf(false)
}

/**
 * Type-ahead search. A single repeated character (aaa) cycles through the items starting with it;
 * a longer buffer finds the first item (from the current one) that starts with the whole buffer.
 * Returns -1 when nothing matches.
 */
export function typeaheadIndex(
  labels: string[],
  disabled: boolean[],
  buffer: string,
  from: number
): number {
  if (!buffer) return -1
  const needle = buffer.toLowerCase()
  const cycling = [...needle].every((c) => c === needle[0])
  const prefix = cycling && needle.length > 1 ? needle[0] : needle
  // A fresh single character starts after the current item, a longer prefix may match the current one.
  const start = needle.length === 1 || cycling ? from + 1 : from
  for (let offset = 0; offset < labels.length; offset++) {
    const i = (start + offset + labels.length) % labels.length
    if (!disabled[i] && labels[i].toLowerCase().startsWith(prefix)) return i
  }
  return -1
}
