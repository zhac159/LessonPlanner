import { useCallback, useRef, useState, type KeyboardEvent } from 'react'

const ITEM = '[data-grid-item]'

export interface RovingItemProps {
  'data-grid-item': ''
  'data-grid-key': string
  tabIndex: 0 | -1
  onFocus: () => void
}

/**
 * Where an arrow key goes. With a layout (a browser) up and down pick the nearest item in the next row by its
 * horizontal centre; without one (happy-dom, zero-size boxes) they jump `columns` items.
 */
function target(items: HTMLElement[], from: number, key: string, columns: number): number {
  const last = items.length - 1
  if (key === 'ArrowRight') return Math.min(from + 1, last)
  if (key === 'ArrowLeft') return Math.max(from - 1, 0)
  if (key === 'Home') return 0
  if (key === 'End') return last
  const dir = key === 'ArrowDown' ? 1 : -1
  const here = items[from]!.getBoundingClientRect()
  if (here.width === 0) return Math.min(Math.max(from + dir * columns, 0), last)
  const centre = here.left + here.width / 2
  const rows = items
    .map((el, index) => ({ index, rect: el.getBoundingClientRect() }))
    .filter(({ rect }) => (dir > 0 ? rect.top >= here.bottom - 1 : rect.bottom <= here.top + 1))
  if (rows.length === 0) return from
  const nearestTop = (dir > 0 ? Math.min : Math.max)(...rows.map(({ rect }) => rect.top))
  const row = rows.filter(({ rect }) => Math.abs(rect.top - nearestTop) < 4)
  row.sort(
    (a, b) =>
      Math.abs(a.rect.left + a.rect.width / 2 - centre) -
      Math.abs(b.rect.left + b.rect.width / 2 - centre)
  )
  return row[0]!.index
}

/**
 * Roving tabindex over every `[data-grid-item]` inside the container: one tab stop, arrows move, Home and End jump.
 * Items are found in the DOM, so several sections (recent, all) behave as one grid. `keys` is the ordered list of
 * item keys (used to pick the tab stop when nothing has focus yet).
 */
export function useRovingGrid(keys: readonly string[], columns = 1) {
  const container = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const current = active !== null && keys.includes(active) ? active : (keys[0] ?? null)

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
        return
      const el = event.target as HTMLElement
      if (!el.matches?.(ITEM) || event.altKey || event.ctrlKey || event.metaKey) return
      const items = Array.from(container.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])
      const from = items.indexOf(el)
      if (from < 0) return
      event.preventDefault()
      const next = items[target(items, from, event.key, columns)]
      if (!next) return
      setActive(next.dataset.gridKey ?? null)
      next.focus()
    },
    [columns]
  )

  const itemProps = useCallback(
    (key: string): RovingItemProps => ({
      'data-grid-item': '',
      'data-grid-key': key,
      tabIndex: key === current ? 0 : -1,
      onFocus: () => setActive(key)
    }),
    [current]
  )

  /** Move focus to the first item (used when a picker opens). */
  const focusFirst = useCallback(() => {
    container.current?.querySelector<HTMLElement>(ITEM)?.focus()
  }, [])

  return { containerRef: container, onKeyDown, itemProps, focusFirst }
}
