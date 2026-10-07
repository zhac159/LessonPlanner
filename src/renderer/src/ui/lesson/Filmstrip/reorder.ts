/** Where a moved slide lands: after this slide, or first when `null` (the `onMove` argument). */
export type AfterId = string | null

/**
 * Where to put `dragId` when it is dropped on the `before` or `after` half of `overId`.
 * Returns the id it should follow, or `undefined` when that would not change the order.
 */
export function dropTarget(
  ids: readonly string[],
  dragId: string,
  overId: string,
  side: 'before' | 'after'
): AfterId | undefined {
  const from = ids.indexOf(dragId)
  if (from < 0 || overId === dragId || !ids.includes(overId)) return undefined
  const rest = ids.filter((id) => id !== dragId)
  const at = rest.indexOf(overId) + (side === 'after' ? 1 : 0)
  const after = rest[at - 1] ?? null
  return after === (ids[from - 1] ?? null) ? undefined : after
}

/**
 * Where `id` goes when nudged one place earlier (`-1`) or later (`1`) with the keyboard.
 * `undefined` at either end of the list or for an unknown id.
 */
export function nudgeTarget(
  ids: readonly string[],
  id: string,
  direction: -1 | 1
): AfterId | undefined {
  const from = ids.indexOf(id)
  const neighbour = ids[from + direction]
  if (from < 0 || neighbour === undefined) return undefined
  return dropTarget(ids, id, neighbour, direction === -1 ? 'before' : 'after')
}
