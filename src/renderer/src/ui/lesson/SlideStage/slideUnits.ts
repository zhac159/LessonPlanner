import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@shared/deck/types'
import type { Point } from '../../overlays/ContextMenu/position'

/**
 * Convert a pointer position (viewport pixels) into slide units (the 1920x1080 space Region loops,
 * sticky notes and element boxes live in), given the stage's bounding rectangle. Positions outside the
 * stage give values outside 0..1920 / 0..1080: the caller decides whether to clamp. A zero-sized
 * rectangle (not laid out yet) maps to the origin.
 */
export function clientToSlide(
  point: Point,
  rect: { left: number; top: number; width: number; height: number }
): Point {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 }
  return {
    x: ((point.x - rect.left) / rect.width) * SLIDE_WIDTH,
    y: ((point.y - rect.top) / rect.height) * SLIDE_HEIGHT
  }
}
