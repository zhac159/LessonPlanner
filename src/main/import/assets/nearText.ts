/** Which text on a slide or page belongs to a picture: a label under a card, a caption beside a photo. */
import type { Box } from './types'

export interface TextItem {
  text: string
  box: Box
}

const MAX_ITEMS = 6
const MAX_CHARS = 200
export const MAX_SLIDE_TEXT = 600

/** The picture box grown by the margins in which a label usually sits (most room below it). */
function reach(box: Box): Box {
  const side = Math.max(24, box.w * 0.05)
  return { x: box.x - side, y: box.y - 48, w: box.w + side * 2, h: box.h + 48 + 150 }
}

const centerIn = (item: Box, region: Box): boolean => {
  const cx = item.x + item.w / 2
  const cy = item.y + item.h / 2
  return cx >= region.x && cx <= region.x + region.w && cy >= region.y && cy <= region.y + region.h
}

/** Text items whose centre lies on or just around the picture, in reading order, one per line. */
export function nearbyText(items: TextItem[], box: Box): string {
  if (box.w <= 0 || box.h <= 0) return ''
  const region = reach(box)
  const picked = items
    .filter((item) => item.text.trim() && centerIn(item.box, region))
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
    .slice(0, MAX_ITEMS)
  return picked
    .map((item) => item.text.trim())
    .join('\n')
    .slice(0, MAX_CHARS)
}

/** All text of a slide or page in reading order, capped. */
export function slideTextOf(items: TextItem[]): string {
  return [...items]
    .filter((item) => item.text.trim())
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
    .map((item) => item.text.trim())
    .join('\n')
    .slice(0, MAX_SLIDE_TEXT)
}

/** Joins text fragments that sit on one baseline (pdf.js reports words or runs) into lines. */
export function mergeLines(fragments: TextItem[]): TextItem[] {
  const sorted = [...fragments].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
  const lines: TextItem[] = []
  for (const fragment of sorted) {
    const last = lines[lines.length - 1]
    const sameLine =
      last &&
      Math.abs(last.box.y + last.box.h - (fragment.box.y + fragment.box.h)) <
        Math.max(4, fragment.box.h * 0.4) &&
      fragment.box.x - (last.box.x + last.box.w) < Math.max(12, fragment.box.h * 1.2)
    if (last && sameLine) {
      const right = Math.max(last.box.x + last.box.w, fragment.box.x + fragment.box.w)
      const top = Math.min(last.box.y, fragment.box.y)
      const bottom = Math.max(last.box.y + last.box.h, fragment.box.y + fragment.box.h)
      last.text +=
        /\s$/.test(last.text) || /^\s/.test(fragment.text) ? fragment.text : ` ${fragment.text}`
      last.box = { x: last.box.x, y: top, w: right - last.box.x, h: bottom - top }
    } else {
      lines.push({ text: fragment.text, box: { ...fragment.box } })
    }
  }
  return lines
    .map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.text)
}
