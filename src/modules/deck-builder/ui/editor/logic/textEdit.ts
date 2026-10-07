/**
 * Direct text editing (06 §8.2): turning the edited text of an element back into paragraphs. Pure.
 */
import { plainText } from '@shared/deck/text'
import type { Element, Paragraph, Run } from '@shared/deck/types'

/** Elements whose paragraphs the teacher can edit in place. */
export type EditableElement = Extract<Element, { paragraphs: Paragraph[] }>

export const isEditableText = (element: Element): element is EditableElement =>
  (element.type === 'text' || element.type === 'callout') && !element.locked

/** The text shown in the editor box: paragraphs joined with line breaks. */
export function editableText(element: EditableElement): string {
  return plainText(element.paragraphs)
}

const formatOf = (run: Run | undefined): Omit<Run, 'text'> => {
  if (!run) return {}
  const { text: _text, ...format } = run
  return format
}

const paragraphText = (paragraph: Paragraph): string => paragraph.runs.map((r) => r.text).join('')

/**
 * Paragraphs for `text`. A line that did not change keeps its runs (so two-colour titles and bold words survive a
 * fix elsewhere); an edited line becomes one run with the formatting of the old paragraph's first run; extra lines
 * copy the list style and formatting of the last old paragraph.
 */
export function textToParagraphs(old: readonly Paragraph[], text: string): Paragraph[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  return lines.map((line, index) => {
    const model = old[index] ?? old[old.length - 1]
    if (old[index] && paragraphText(old[index]) === line) return old[index]
    const paragraph: Paragraph = { runs: [{ ...formatOf(model?.runs[0]), text: line }] }
    if (model?.list) paragraph.list = model.list
    if (model?.level !== undefined) paragraph.level = model.level
    return paragraph
  })
}

/** True when the edited text differs from what the element already says. */
export function textChanged(element: EditableElement, text: string): boolean {
  return editableText(element) !== text.replace(/\r\n?/g, '\n')
}

/** Roughly how big the text is drawn, in slide units, so the editing box looks like the text it replaces. */
export function editorFontUnits(element: EditableElement): number {
  const pt = element.type === 'text' ? element.fontSizePt : undefined
  if (pt) return pt * 2
  if (element.type === 'text' && element.role === 'title') return 84
  if (element.type === 'text' && element.role === 'caption') return 28
  return 40
}
