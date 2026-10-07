import type { CSSProperties } from 'react'
import type { ResolvedTextStyle } from '@shared/deck/textStyle'
import type { Paragraph } from '@shared/deck/types'
import { resolveColor } from '@shared/deck/tokens'
import { useSlideContext } from '../context'
import { slideFonts } from '../bundledFonts'
import { isListOnly } from '../paragraphs'
import { useTextFit } from '../useTextFit'
import { Paragraphs } from './Paragraphs'

interface FittedTextProps {
  elementId: string
  paragraphs: readonly Paragraph[]
  textStyle: ResolvedTextStyle
  align?: 'left' | 'center' | 'right'
  valign?: 'top' | 'middle' | 'bottom'
  /** Shrink-to-fit (`autoFit: 'shrink'`). */
  shrink: boolean
  /** Size of the box in slide units (re-fits when it changes). */
  width: number
  height: number
}

/**
 * Text that fills its box: the font size is `base * --fit`, where `--fit` comes from the shrink-to-fit
 * measurement. Shows the orange "doesn't fit" badge (editor only) when it still overflows at 60%.
 */
export function FittedText({
  elementId,
  paragraphs,
  textStyle,
  align = 'left',
  valign = 'top',
  shrink,
  width,
  height
}: FittedTextProps) {
  const ctx = useSlideContext()
  const { ref, overflow } = useTextFit({
    shrink,
    track: ctx.showFitBadges || ctx.onOverflowChange !== undefined,
    measurer: ctx.measurer,
    content: paragraphs,
    style: textStyle,
    sizePt: textStyle.sizePt,
    width,
    height,
    onOverflowChange: ctx.onOverflowChange && ((o) => ctx.onOverflowChange?.(elementId, o))
  })
  const css = {
    '--base': `${textStyle.sizePt * 2}px`,
    fontFamily: slideFonts.fontFamilyCss(textStyle.font),
    fontWeight: textStyle.weight,
    color: textStyle.color,
    textTransform: textStyle.uppercase ? 'uppercase' : undefined,
    letterSpacing: textStyle.letterSpacingEm ? `${textStyle.letterSpacingEm}em` : undefined
  } as CSSProperties
  return (
    <div ref={ref} className={`slide-text slide-text--${valign}`} style={css}>
      <div
        className="slide-text__content"
        role={isListOnly(paragraphs) ? 'list' : undefined}
        style={{ textAlign: align }}
      >
        <Paragraphs
          paragraphs={paragraphs}
          style={ctx.style}
          checkColor={resolveColor('token:accent', ctx.style)}
        />
      </div>
      {ctx.showFitBadges && overflow && (
        <span className="slide-fit-badge" role="status">
          Doesn’t fit
        </span>
      )}
    </div>
  )
}
