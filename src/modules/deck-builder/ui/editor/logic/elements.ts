/**
 * Elements on the stage (06 §8.2): which ones the Select tool can pick, how they are named for screen readers and
 * how arrow keys and drags move them. Pure; all numbers are slide units (1920×1080).
 */
import { elementText } from '@shared/deck/text'
import type { Element, Slide } from '@shared/deck/types'

/** Elements the teacher can pick: style decorations are locked and stay put. Paint order (back to front). */
export function selectableElements(slide: Slide): Element[] {
  return slide.elements
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => !element.locked)
    .sort((a, b) => (a.element.z ?? 0) - (b.element.z ?? 0) || a.index - b.index)
    .map(({ element }) => element)
}

const KIND_NAMES: Record<Element['type'], string> = {
  text: 'Text box',
  chips: 'Key words',
  callout: 'Callout',
  image: 'Picture',
  diagram: 'Diagram',
  shape: 'Shape',
  table: 'Table'
}

const SNIPPET = 40

/** "Text box: What do plants need?", "Picture: photo". */
export function elementLabel(element: Element): string {
  const kind = element.name
    ? element.name.charAt(0).toUpperCase() + element.name.slice(1)
    : KIND_NAMES[element.type]
  const text = elementText(element).replace(/\s+/g, ' ').trim()
  if (!text || text === element.name) return kind
  // A picture whose caption already starts "Photo:" must not read "Photo: Photo: leaf in sunlight".
  if (text.toLowerCase().startsWith(`${kind.toLowerCase()}:`)) return clip(text)
  return `${kind}: ${clip(text)}`
}

const clip = (text: string): string =>
  text.length > SNIPPET ? `${text.slice(0, SNIPPET - 1)}…` : text

const NUDGES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

/** Arrow keys move an element 10 units, Shift 50 (06 §8.2). Null for other keys. */
export function nudgeDelta(key: string, shift: boolean): { dx: number; dy: number } | null {
  const direction = NUDGES[key]
  if (!direction) return null
  const step = shift ? 50 : 10
  return { dx: direction[0] * step, dy: direction[1] * step }
}

/** Pointer movement (CSS pixels) smaller than this is a click, not a drag. */
export const DRAG_THRESHOLD_PX = 4

/** Slide-unit offset for a pointer movement of `dx`, `dy` pixels at `scale` pixels per unit. */
export function dragOffset(dx: number, dy: number, scale: number): { x: number; y: number } {
  if (scale <= 0) return { x: 0, y: 0 }
  return { x: Math.round(dx / scale), y: Math.round(dy / scale) }
}

/** True once the pointer moved far enough to count as a drag. */
export const isDrag = (dx: number, dy: number): boolean => Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX
