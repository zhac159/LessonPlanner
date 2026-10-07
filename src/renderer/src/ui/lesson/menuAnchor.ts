import type { MouseEvent } from 'react'
import { anchorBelow, type Point } from '../overlays/ContextMenu/position'

/**
 * Where to open a context menu for a `contextmenu` event: at the pointer, or under the element when
 * the event came from the keyboard (Shift+F10 or the menu key report a pointer at 0,0).
 */
export function anchorForContextMenu(
  event: Pick<MouseEvent, 'clientX' | 'clientY'>,
  element: Parameters<typeof anchorBelow>[0]
): Point {
  const fromKeyboard = event.clientX === 0 && event.clientY === 0
  return fromKeyboard ? anchorBelow(element) : { x: event.clientX, y: event.clientY }
}
