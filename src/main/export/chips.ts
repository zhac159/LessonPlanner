/** Chips: key-word pills, laid out with the same maths the renderer uses. */
import { layoutChips } from '@shared/deck/layout'
import type { ChipsElement, ColorValue } from '@shared/deck/types'
import { hexOf, inchBox, noteFont, type SlideContext } from './context'
import { resolveFont } from './fonts'
import { cleanInline } from './sanitize'
import { fillProps } from './shape'

/** One rounded pill shape (with its text) per chip, at computed positions, never autofit. */
export function addChipsElement(ctx: SlideContext, el: ChipsElement): void {
  const styleRef = el.styleRef ?? 'chip'
  const font = noteFont(ctx, resolveFont('chip', ctx.style, styleRef))
  const fill = (ctx.style?.components[styleRef]?.fill ?? 'token:chipBg') as ColorValue
  const items = el.items.map(cleanInline)
  layoutChips(items, el, ctx.style, styleRef).forEach((chip, i) => {
    const box = inchBox(chip)
    ctx.slide.addText(chip.text, {
      ...box,
      objectName: `${el.name ?? el.id} ${i + 1}`,
      shape: ctx.pptx.ShapeType.roundRect,
      rectRadius: box.h / 2,
      fill: fillProps(ctx, { color: fill }),
      fontFace: font.family,
      fontSize: font.sizePt,
      bold: font.bold,
      color: hexOf(ctx, font.color),
      align: 'center',
      valign: 'middle',
      margin: 0,
      wrap: false,
      fit: 'none'
    })
  })
}
