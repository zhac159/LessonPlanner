export interface Box {
  top: number
  left: number
  width: number
  height: number
}

export interface Placement {
  /** Viewport coordinates (the popup is `position: fixed`). */
  top: number
  left: number
  side: 'below' | 'above'
  /** Horizontal transform-origin (px from the popup's left edge): the trigger's centre. */
  originX: number
}

export interface PlacementInput {
  anchor: Box
  menuWidth: number
  menuHeight: number
  viewportWidth: number
  viewportHeight: number
  /** Space between trigger and popup (default 8). */
  gap?: number
  /** Minimum distance kept from the viewport edge (default 8). */
  margin?: number
}

/**
 * Where to put a popup relative to its trigger: 8px below, left-aligned, flipped above when it does
 * not fit below but does fit above, and kept inside the viewport horizontally.
 */
export function computePlacement({
  anchor,
  menuWidth,
  menuHeight,
  viewportWidth,
  viewportHeight,
  gap = 8,
  margin = 8
}: PlacementInput): Placement {
  const below = anchor.top + anchor.height + gap
  const above = anchor.top - gap - menuHeight
  const fitsBelow = below + menuHeight <= viewportHeight - margin
  const side = !fitsBelow && above >= margin ? 'above' : 'below'
  const maxLeft = Math.max(margin, viewportWidth - menuWidth - margin)
  const left = Math.min(Math.max(anchor.left, margin), maxLeft)
  return {
    top: side === 'below' ? below : above,
    left,
    side,
    originX: anchor.left + anchor.width / 2 - left
  }
}
