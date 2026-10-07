/** Plain-text helpers over the deck model (used by the outline, thumbnails' labels, search and export). */
import type { Element, Paragraph, Slide } from './types'

/** Concatenates the runs of each paragraph and joins paragraphs with `\n`. */
export function plainText(paragraphs: readonly Paragraph[]): string {
  return paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n')
}

/** Text of the slide's first `title` element on one line (empty string when there is none). */
export function titleText(slide: Slide): string {
  for (const el of slide.elements) {
    if (el.type === 'text' && el.role === 'title')
      return plainText(el.paragraphs)
        .replace(/\s*\n\s*/g, ' ')
        .trim()
  }
  return ''
}

/** Human-readable text of any element (alt text for pictures and diagrams, cells for tables). */
export function elementText(element: Element): string {
  switch (element.type) {
    case 'text':
      return plainText(element.paragraphs)
    case 'callout':
      return [element.label, plainText(element.paragraphs)].filter(Boolean).join(' ')
    case 'chips':
      return element.items.join(', ')
    case 'image':
      return element.placeholder?.description ?? element.alt
    case 'diagram':
      return element.alt
    case 'table':
      return element.rows.map((row) => row.join(' | ')).join('\n')
    case 'shape':
      return ''
  }
}
