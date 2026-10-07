import { chipLayoutStyle, layoutChips } from '@shared/deck/layout'
import { findComponent } from '@shared/deck/textStyle'
import { resolveColor, resolveFont } from '@shared/deck/tokens'
import type { ChipsElement, ColorValue } from '@shared/deck/types'
import { useSlideContext } from '../context'
import { slideFonts } from '../bundledFonts'

const PILL_RADIUS = 999

/**
 * Key word pills in a wrapping row. Positions come from the shared `layoutChips` (the same maths the
 * .pptx export uses), so what you see is where the export puts them.
 */
export function ChipsView({ element }: { element: ChipsElement }) {
  const { style } = useSlideContext()
  const key = element.styleRef ?? 'chip'
  const component = findComponent(style, key)
  const look = chipLayoutStyle(style, key)
  const font = resolveFont(component?.font ?? 'body', style)
  const fill = resolveColor((component?.fill ?? 'token:chipBg') as ColorValue, style)
  const color = resolveColor((component?.color ?? 'token:chipText') as ColorValue, style)
  const chips = layoutChips(element.items, { x: 0, y: 0, w: element.w, h: element.h }, style, key)
  return (
    <>
      {chips.map((chip, i) => (
        <span
          key={`${chip.text}-${i}`}
          className="slide-chip"
          style={{
            left: chip.x,
            top: chip.y,
            width: chip.w,
            height: chip.h,
            background: fill,
            color,
            borderRadius: component?.radius ?? PILL_RADIUS,
            fontFamily: slideFonts.fontFamilyCss(font),
            fontWeight: look.bold ? Math.max(font.weight, 700) : font.weight,
            fontSize: look.fontSizePt * 2
          }}
        >
          {chip.text}
        </span>
      ))}
    </>
  )
}
