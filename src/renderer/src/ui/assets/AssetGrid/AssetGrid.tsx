import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '../../atoms/cx'
import { useRovingGrid, type RovingItemProps } from '../internal/useRovingGrid'
import './AssetGrid.css'

/** Past this many items the grid draws a window and reveals more on scroll (or on "Show more"). */
export const GRID_WINDOW = 120
const GRID_STEP = 60

export interface AssetGridProps<T> {
  items: readonly T[]
  getKey: (item: T) => string
  /** Draw one item; spread `itemProps` onto its button so the grid can rove focus. */
  renderItem: (item: T, itemProps: RovingItemProps) => ReactNode
  /** Names the group for screen readers: "Your assets". */
  label: string
  /** cards = A1/A8 `auto-fill, minmax(176px, 1fr)`; tiles = 3 columns; results = 3 wide columns. */
  layout?: 'cards' | 'tiles' | 'results'
  /** Columns for the Up and Down arrows when there is no layout to measure (tests); 3 for tiles and results. */
  columns?: number
  /** How many items to draw before "Show more" (default 120). */
  windowSize?: number
  /** Shown instead of the grid when there are no items. */
  empty?: ReactNode
  className?: string
}

/**
 * A roving-tabindex grid: one tab stop, arrow keys move, Home and End jump. Beyond `windowSize` items it draws a
 * window and reveals 60 more when the end scrolls into view or "Show more" is pressed.
 */
export function AssetGrid<T>({
  items,
  getKey,
  renderItem,
  label,
  layout = 'cards',
  columns,
  windowSize = GRID_WINDOW,
  empty,
  className
}: AssetGridProps<T>) {
  const [shown, setShown] = useState(windowSize)
  const more = useRef<HTMLButtonElement | null>(null)
  const visible = items.slice(0, shown)
  const keys = visible.map(getKey)
  const roving = useRovingGrid(keys, columns ?? (layout === 'cards' ? 4 : 3))
  const hidden = items.length - visible.length

  useEffect(() => {
    const target = more.current
    if (!target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setShown((n) => n + GRID_STEP)
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [hidden > 0, shown]) // eslint-disable-line react-hooks/exhaustive-deps

  if (items.length === 0) return <>{empty}</>
  return (
    <div className={cx('as-grid-wrap', className)}>
      <div
        ref={roving.containerRef}
        className="as-grid"
        data-layout={layout}
        role="group"
        aria-label={label}
        onKeyDown={roving.onKeyDown}
      >
        {visible.map((item, index) => (
          <div key={keys[index]} className="as-grid__cell">
            {renderItem(item, roving.itemProps(keys[index]!))}
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <button
          ref={more}
          type="button"
          className="as-grid__more"
          onClick={() => setShown((n) => n + GRID_STEP)}
        >
          {`Show more (${hidden} left)`}
        </button>
      )}
    </div>
  )
}
