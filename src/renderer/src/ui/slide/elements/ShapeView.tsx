import { resolveColor } from '@shared/deck/tokens'
import type { ShapeElement } from '@shared/deck/types'
import { useSlideContext } from '../context'

const ARROW_HEAD = 3 // arrow head length, in multiples of the stroke width

/** Rect, rounded rect, ellipse, line or arrow, drawn as SVG filling the element box. */
export function ShapeView({ element }: { element: ShapeElement }) {
  const { style } = useSlideContext()
  const { w, h, shape, stroke, fill } = element
  const strokeWidth = stroke?.width ?? 0
  const common = {
    fill: fill ? resolveColor(fill.color, style) : 'none',
    fillOpacity: fill?.opacity,
    stroke: stroke ? resolveColor(stroke.color, style) : 'none',
    strokeWidth,
    strokeDasharray: stroke?.dash === 'dash' ? `${strokeWidth * 3} ${strokeWidth * 2}` : undefined
  }
  const inset = strokeWidth / 2
  const lineStroke = { ...common, fill: 'none', stroke: stroke ? common.stroke : 'currentColor' }
  const headLength = Math.max(ARROW_HEAD * (strokeWidth || 4), 12)

  let body
  switch (shape) {
    case 'rect':
    case 'roundRect':
      body = (
        <rect
          x={inset}
          y={inset}
          width={Math.max(w - strokeWidth, 0)}
          height={Math.max(h - strokeWidth, 0)}
          rx={shape === 'roundRect' ? (element.radius ?? 0) : 0}
          {...common}
        />
      )
      break
    case 'ellipse':
      body = (
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={Math.max((w - strokeWidth) / 2, 0)}
          ry={Math.max((h - strokeWidth) / 2, 0)}
          {...common}
        />
      )
      break
    case 'line':
      body = <line x1={0} y1={h / 2} x2={w} y2={h / 2} {...lineStroke} />
      break
    case 'arrow':
      body = (
        <>
          <line x1={0} y1={h / 2} x2={w - headLength / 2} y2={h / 2} {...lineStroke} />
          <polygon
            points={`${w},${h / 2} ${w - headLength},${h / 2 - headLength / 2} ${w - headLength},${h / 2 + headLength / 2}`}
            fill={lineStroke.stroke}
            stroke="none"
          />
        </>
      )
      break
  }
  return (
    <svg
      className="slide-shape"
      width="100%"
      height="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {body}
    </svg>
  )
}
