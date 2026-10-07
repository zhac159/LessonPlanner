/**
 * Shrink-to-fit for text (design/deck-model.md §4): measure, then shrink the font in 2% steps down to 60%.
 * The search is pure and the DOM measurement is injectable, so it is unit-testable without layout.
 */

/** Font-size step per iteration (2%). */
export const FIT_STEP = 0.02
/** Smallest allowed font factor (60%). */
export const MIN_FIT = 0.6
const LAST_STEP = Math.round((1 - MIN_FIT) / FIT_STEP)

/** The layout numbers a measurer needs (any HTMLElement satisfies it; keeps this file free of the DOM lib). */
export interface FitBox {
  scrollHeight: number
  clientHeight: number
  scrollWidth: number
  clientWidth: number
}

/** `true` when the content of `box` fits it with the font factor `factor` (already applied as `--fit`). */
export type FitMeasurer = (box: FitBox, factor: number) => boolean

/** Default measurer: layout says nothing overflows the box (1px tolerance for rounding). */
export const domFitMeasurer: FitMeasurer = (box) =>
  box.scrollHeight <= box.clientHeight + 1 && box.scrollWidth <= box.clientWidth + 1

export interface FitResult {
  /** Font-size multiplier in [0.6, 1]. */
  factor: number
  /** Still overflowing at the final factor: the editor shows a "doesn't fit" badge. */
  overflow: boolean
}

/** Factor for step `i` (0 = full size), rounded so 0.98, 0.96... stay exact. */
export const factorAt = (step: number): number => Math.round((1 - step * FIT_STEP) * 100) / 100

/**
 * Finds the largest factor (in 2% steps, at least 60%) at which `fitsAt` is true, assuming that shrinking
 * never makes text fit worse. Binary search: about 5 measurements even in the worst case.
 * With `shrink` false only full size is tried.
 */
export function findFitFactor(fitsAt: (factor: number) => boolean, shrink: boolean): FitResult {
  if (fitsAt(1)) return { factor: 1, overflow: false }
  if (!shrink) return { factor: 1, overflow: true }
  if (!fitsAt(MIN_FIT)) return { factor: MIN_FIT, overflow: true }
  let tooBig = 0
  let fits = LAST_STEP
  while (fits - tooBig > 1) {
    const mid = (tooBig + fits) >> 1
    if (fitsAt(factorAt(mid))) fits = mid
    else tooBig = mid
  }
  return { factor: factorAt(fits), overflow: false }
}
