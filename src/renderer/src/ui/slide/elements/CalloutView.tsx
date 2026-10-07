import type { CSSProperties } from 'react'
import { readableOn } from '@shared/deck/colorGuards'
import {
  bubblePathData,
  BUBBLE_RADIUS,
  BUBBLE_STROKE,
  resolveTail,
  speechBubbleShape
} from '@shared/deck/speechBubble'
import { resolveTextStyle, findComponent } from '@shared/deck/textStyle'
import { resolveColor } from '@shared/deck/tokens'
import type { CalloutElement, ColorValue } from '@shared/deck/types'
import { useSlideContext } from '../context'
import { withLabel } from '../paragraphs'
import { FittedText } from './FittedText'

const DEFAULT_PADDING: [number, number] = [24, 32]
const DEFAULT_RADIUS = 19

/** Rounded box with an optional bold label, styled by `callout.<variant>` (e.g. the yellow mini-whiteboard box). */
export function CalloutView({ element }: { element: CalloutElement }) {
  const { style } = useSlideContext()
  const key = element.styleRef ?? `callout.${element.variant}`
  const component = findComponent(style, key)
  const bubble = element.variant === 'speech-bubble'
  const [padY, padX] = component?.padding ?? DEFAULT_PADDING
  const fill = resolveColor(
    (component?.fill ?? (bubble ? 'token:chipBg' : 'token:highlight')) as ColorValue,
    style
  )
  const textStyle = resolveTextStyle({ role: 'body', styleRef: key }, style)
  const box: CSSProperties = bubble
    ? { padding: `${padY}px ${padX}px` }
    : {
        background: fill,
        borderRadius: component?.radius ?? DEFAULT_RADIUS,
        padding: `${padY}px ${padX}px`
      }
  return (
    <div className="slide-callout" style={box} data-variant={element.variant}>
      {bubble && (
        <BubbleOutline
          element={element}
          fill={fill}
          stroke={resolveColor('token:text', style)}
          radius={component?.radius}
        />
      )}
      <FittedText
        elementId={element.id}
        paragraphs={withLabel(element.paragraphs, element.label)}
        textStyle={
          bubble ? { ...textStyle, color: readableOn(fill, [textStyle.color]) } : textStyle
        }
        valign="middle"
        shrink
        width={element.w - 2 * padX}
        height={element.h - 2 * padY}
      />
    </div>
  )
}

/** The wedge speech bubble: white (her chip colour) with a thin outline and a tail; drawn behind the text. */
function BubbleOutline({
  element,
  fill,
  stroke,
  radius
}: {
  element: CalloutElement
  fill: string
  stroke: string
  radius: number | undefined
}) {
  const { path } = speechBubbleShape(
    element.w,
    element.h,
    radius ?? BUBBLE_RADIUS,
    resolveTail(element)
  )
  return (
    <svg
      className="slide-bubble"
      width={element.w}
      height={element.h}
      viewBox={`0 0 ${element.w} ${element.h}`}
      aria-hidden="true"
    >
      <path
        d={bubblePathData(path)}
        fill={fill}
        stroke={stroke}
        strokeWidth={BUBBLE_STROKE}
        strokeLinejoin="round"
      />
    </svg>
  )
}
