/** Tables: an optional header row and plain body cells with thin borders. */
import type PptxGenJS from 'pptxgenjs'
import { readableOn } from '@shared/deck/colorGuards'
import { unitsToInches } from '@shared/deck/layout'
import type { TableElement } from '@shared/deck/types'
import { hexOf, inchBox, noteFont, slideWarn, type SlideContext } from './context'
import { resolveFont } from './fonts'
import { cleanInline } from './sanitize'

/** Column widths in inches: the element's own widths scaled to its box, else equal columns. */
function columnWidths(el: TableElement, columns: number): number[] {
  const given = el.colWidths
  const total = given?.reduce((a, b) => a + b, 0) ?? 0
  if (given && given.length === columns && total > 0) {
    return given.map((w) => unitsToInches((w / total) * el.w))
  }
  return Array.from({ length: columns }, () => unitsToInches(el.w / columns))
}

/** Adds a table; ragged rows are padded with empty cells so PowerPoint never sees a broken grid. */
export function addTableElement(ctx: SlideContext, el: TableElement): void {
  const columns = Math.max(0, ...el.rows.map((r) => r.length))
  if (el.rows.length === 0 || columns === 0) {
    slideWarn(ctx, 'an empty table was left out.')
    return
  }
  const font = noteFont(ctx, resolveFont('table', ctx.style, el.styleRef))
  const border: PptxGenJS.BorderProps = { type: 'solid', pt: 1, color: hexOf(ctx, 'token:muted') }
  const headerFill = hexOf(ctx, 'token:accent')
  // White text on the accent fill, unless the accent is so light that white would vanish (contrast guard).
  const headerText = readableOn(`#${headerFill}`, ['#FFFFFF']).slice(1)
  const rows: PptxGenJS.TableRow[] = el.rows.map((cells, ri) => {
    const isHeader = el.headerRow && ri === 0
    return Array.from({ length: columns }, (_, ci) => ({
      text: cleanInline(cells[ci] ?? ''),
      options: {
        bold: isHeader || font.bold,
        color: isHeader ? headerText : hexOf(ctx, font.color),
        fill: isHeader ? { color: headerFill } : undefined,
        valign: 'middle' as const,
        border
      }
    }))
  })
  const box = inchBox(el)
  ctx.slide.addTable(rows, {
    x: box.x,
    y: box.y,
    w: box.w,
    colW: columnWidths(el, columns),
    rowH: box.h / el.rows.length,
    fontFace: font.family,
    fontSize: font.sizePt,
    margin: 0.08,
    objectName: el.name ?? el.id
  })
}
