export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/**
 * Keep a popup of `size` fully inside `viewport`, `margin` px from every edge, starting from the
 * wanted top-left corner. If it cannot fit on one side it is pushed back to the margin.
 */
export function clampToViewport(wanted: Point, size: Size, viewport: Size, margin = 8): Point {
  const maxX = viewport.width - size.width - margin
  const maxY = viewport.height - size.height - margin
  return {
    x: Math.max(margin, Math.min(wanted.x, maxX)),
    y: Math.max(margin, Math.min(wanted.y, maxY))
  }
}

/** Where to open a menu for a trigger element: just under its left edge. */
export function anchorBelow(
  element: { getBoundingClientRect(): { left: number; bottom: number } },
  gap = 4
): Point {
  const rect = element.getBoundingClientRect()
  return { x: rect.left, y: rect.bottom + gap }
}
