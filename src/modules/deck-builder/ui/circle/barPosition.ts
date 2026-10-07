/** Where the "Add asset here" bar sits by a loop (A10): bottom-right of its box, clamped inside the stage. Pure. */
export interface BarBox {
  x: number
  y: number
  w: number
  h: number
}

/** About how big the bar is, to keep it inside the stage before it has been measured. */
export const BAR_WIDTH = 330
export const BAR_HEIGHT = 52
const GAP = 8

/**
 * `left` is where the bar's RIGHT edge goes (the bar is shifted left by its own width); it flips above the loop
 * when there is no room below, so it never leaves the stage and never covers the label at the loop's top-left.
 */
export function barPosition(
  bbox: BarBox,
  scale: number,
  stage: { width: number; height: number }
): { left: number; top: number } {
  const right = (bbox.x + bbox.w) * scale
  const bottom = (bbox.y + bbox.h) * scale
  const left = Math.min(Math.max(right, Math.min(BAR_WIDTH, stage.width)), stage.width)
  const below = bottom + GAP
  const top =
    below + BAR_HEIGHT <= stage.height ? below : Math.max(GAP, bbox.y * scale - GAP - BAR_HEIGHT)
  return { left, top }
}
