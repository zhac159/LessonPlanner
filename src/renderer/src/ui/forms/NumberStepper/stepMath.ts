/** Clamps `n` into [min, max]; a missing bound is open. */
export function clamp(n: number, min?: number, max?: number): number {
  let out = n
  if (min !== undefined) out = Math.max(min, out)
  if (max !== undefined) out = Math.min(max, out)
  return out
}

/** Number of decimal places in `n` (0 for integers). */
function decimals(n: number): number {
  const [, fraction = ''] = String(n).split('.')
  return fraction.length
}

/** Moves `value` by `delta`, clamps it and removes floating point noise (0.1 + 0.2). */
export function stepBy(
  value: number,
  delta: number,
  step: number,
  min?: number,
  max?: number
): number {
  const places = Math.max(decimals(value), decimals(step), decimals(delta))
  return clamp(Number((value + delta).toFixed(places)), min, max)
}

/** Parses what the user typed; `null` when it is empty or not a finite number. */
export function parseNumber(text: string): number | null {
  if (text.trim() === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}
