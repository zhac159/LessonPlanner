/** Text elements: paragraphs of styled runs with bullets, numbers and checkboxes. */
import type PptxGenJS from 'pptxgenjs'
import { stripUnresolvedDates } from '@shared/deck/dates'
import type { Paragraph, Run, TextElement } from '@shared/deck/types'
import { hexOf, inchBox, noteFont, type SlideContext } from './context'
import { resolveFont, type ResolvedFont } from './fonts'
import { cleanInline } from './sanitize'

type Bullet = NonNullable<PptxGenJS.TextPropsOptions['bullet']>

/** U+2610 BALLOT BOX, the tick-box glyph for `list: 'checkbox'`. */
const CHECKBOX_CODE = '2610'

function bulletFor(list: Paragraph['list']): Bullet | undefined {
  if (list === 'bullet') return true
  if (list === 'number') return { type: 'number' }
  if (list === 'checkbox') return { code: CHECKBOX_CODE }
  return undefined
}

function runText(run: Run, font: ResolvedFont): string {
  const text = stripUnresolvedDates(cleanInline(run.text))
  return font.uppercase ? text.toUpperCase() : text
}

/**
 * Turns paragraphs into PptxGenJS text runs: each run keeps its own colour/bold/italic/underline,
 * paragraph-level options (bullets, indent) ride on the paragraph's first run, and a line break
 * ends every paragraph but the last. `leadRuns` are prepended to the first paragraph (callout label).
 */
export function buildRuns(
  ctx: SlideContext,
  paragraphs: readonly Paragraph[],
  font: ResolvedFont,
  leadRuns: readonly Run[] = []
): PptxGenJS.TextProps[] {
  const out: PptxGenJS.TextProps[] = []
  const list = paragraphs.length > 0 ? paragraphs : [{ runs: [] }]
  list.forEach((paragraph, pi) => {
    const runs = [...(pi === 0 ? leadRuns : []), ...paragraph.runs]
    const safeRuns: readonly Run[] = runs.length > 0 ? runs : [{ text: '' }]
    const bullet = bulletFor(paragraph.list)
    safeRuns.forEach((run, ri) => {
      const options: PptxGenJS.TextPropsOptions = {
        fontFace: font.family,
        fontSize: font.sizePt,
        bold: run.bold ?? font.bold,
        italic: run.italic ?? false,
        color: hexOf(ctx, run.color ?? font.color)
      }
      if (run.underline) options.underline = { style: 'sng' }
      if (font.letterSpacingPt > 0) options.charSpacing = font.letterSpacingPt
      if (ri === 0) {
        if (bullet) {
          options.bullet = bullet
          options.paraSpaceAfter = Math.round(font.sizePt * 0.35)
        }
        if (paragraph.level) options.indentLevel = paragraph.level
      }
      if (ri === safeRuns.length - 1 && pi < list.length - 1) options.breakLine = true
      out.push({ text: runText(run, font), options })
    })
  })
  return out
}

/** Adds a text element at its own box; text insets are zero so it lines up with the preview. */
export function addTextElement(ctx: SlideContext, el: TextElement): void {
  const font = noteFont(ctx, resolveFont(el.role, ctx.style, el.styleRef))
  if (el.fontSizePt) font.sizePt = el.fontSizePt
  ctx.slide.addText(buildRuns(ctx, el.paragraphs, font), {
    ...inchBox(el),
    objectName: el.name ?? el.id,
    margin: 0,
    align: el.align ?? 'left',
    valign: el.valign ?? 'top',
    fit: (el.autoFit ?? 'shrink') === 'shrink' ? 'shrink' : 'none',
    rotate: el.rotation
  })
}
