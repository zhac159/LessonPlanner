/**
 * Where the main window opens. Pure functions over plain display rectangles (no `electron` import),
 * so they are unit-testable; src/main/window.ts feeds them `screen.getAllDisplays()`.
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayLike {
  id: number
  bounds: Rect
  workArea: Rect
}

export interface PickOptions {
  /** Development/test runs only: use the first non-primary monitor so automation stays out of the way. */
  secondary?: boolean
  /** Explicit override (left-to-right index); wins over `secondary` when valid. */
  index?: number
}

/**
 * Normal use opens on the PRIMARY monitor. Automated runs (SLIDE_PLANNER_TEST=1) or an explicit
 * SLIDE_PLANNER_DISPLAY=<n> use another one: `secondary` picks the left-most non-primary display,
 * falling back to the primary when there is only one.
 */
export function pickDisplay<T extends DisplayLike>(
  displays: readonly T[],
  primaryId: number,
  options: PickOptions = {}
): T {
  if (displays.length === 0) throw new Error('No displays available')
  const ordered = [...displays].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
  const primary = ordered.find((d) => d.id === primaryId) ?? ordered[0]
  if (options.index !== undefined && ordered[options.index]) return ordered[options.index]
  if (options.secondary) return ordered.find((d) => d.id !== primary.id) ?? primary
  return primary
}

/** A window of `size` centred in `area`, shrunk if the area is smaller. */
export function centeredBounds(area: Rect, size: { width: number; height: number }): Rect {
  const width = Math.min(size.width, area.width)
  const height = Math.min(size.height, area.height)
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width,
    height
  }
}

/** Parses SLIDE_PLANNER_DISPLAY ("0", "1", …); anything else means "no override". */
export function parseDisplayOverride(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value.trim())) return undefined
  return Number(value.trim())
}
