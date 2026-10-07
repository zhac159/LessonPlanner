import { cx } from '../cx'
import './SwatchStack.css'

/** A single 16px colour dot with an ink border (the style chip in the editor header). */
export function SwatchDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cx('ui-swatch-dot', className)}
      style={{ background: color }}
      aria-hidden="true"
    />
  )
}

export interface SwatchStackProps {
  /** CSS colours, most important first. */
  colors: ReadonlyArray<string>
  /** How many circles to show before "+N". */
  max?: number
  className?: string
}

/** Overlapping colour circles that hint at a style's palette. Decorative: nearby text says it all. */
export function SwatchStack({ colors, max = 4, className }: SwatchStackProps) {
  const shown = colors.slice(0, max)
  const extra = colors.length - shown.length
  return (
    <span className={cx('ui-swatches', className)} aria-hidden="true">
      {shown.map((color, index) => (
        <span
          key={`${color}-${index}`}
          className="ui-swatches__dot"
          style={{ background: color }}
        />
      ))}
      {extra > 0 && <span className="ui-swatches__more">+{extra}</span>}
    </span>
  )
}
