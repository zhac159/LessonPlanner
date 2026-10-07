import { useId, useState, type ReactNode } from 'react'
import { Card, cx } from '../../atoms'
import './LearnedCard.css'

export interface LearnedCardProps<T> {
  /** The h3, e.g. "Colours". */
  title: string
  /** The learned rows. `null` = nothing learned yet: three skeleton rows are shown instead. */
  items: readonly T[] | null
  /** Renders one row's content (the card wraps it in the `li`). */
  renderItem: (item: T, index: number) => ReactNode
  /** A stable React key for one row. */
  itemKey: (item: T, index: number) => string
  /** Rows shown before "Show all". Everything is shown when omitted. */
  limit?: number
  /** `rows` stack vertically; `tags` wrap like chips. */
  layout?: 'rows' | 'tags'
  /** Shown when the list is learned but empty. */
  emptyText?: string
  className?: string
}

const SKELETON_ROWS = [0, 1, 2]

/**
 * The shell of one "What I've learned so far" sub-card: heading, a list that is a skeleton while
 * nothing is learned, and a "Show all" toggle when the list is longer than `limit` (04 §7).
 */
export function LearnedCard<T>({
  title,
  items,
  renderItem,
  itemKey,
  limit,
  layout = 'rows',
  emptyText = 'Nothing picked up yet.',
  className
}: LearnedCardProps<T>) {
  const headingId = useId()
  const listId = useId()
  const [expanded, setExpanded] = useState(false)
  const building = items === null
  const overflowing = items !== null && limit !== undefined && items.length > limit
  const visible = items === null ? [] : overflowing && !expanded ? items.slice(0, limit) : items

  return (
    <Card
      as="section"
      variant="inner"
      tone="white"
      className={cx('lc', className)}
      aria-labelledby={headingId}
      aria-busy={building || undefined}
    >
      <h3 id={headingId} className="lc__title">
        {title}
      </h3>
      {building ? (
        <ul className="lc__list" data-layout={layout} aria-hidden="true">
          {SKELETON_ROWS.map((row) => (
            <li key={row} className="lc__skeleton" data-layout={layout} />
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="lc__empty">{emptyText}</p>
      ) : (
        <ul id={listId} className="lc__list" data-layout={layout}>
          {visible.map((item, index) => (
            <li key={itemKey(item, index)} className="lc__item">
              {renderItem(item, index)}
            </li>
          ))}
        </ul>
      )}
      {overflowing && (
        <button
          type="button"
          className="lc__more"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Show fewer' : 'Show all'}
        </button>
      )}
    </Card>
  )
}
