import type { ReactNode } from 'react'
import { Button } from '../../atoms/Button/Button'
import { cx } from '../../atoms/cx'
import './SelectionBar.css'

export interface SelectionBarProps {
  count: number
  /** The small line after the count: "Pick a few that show the look you want". */
  hint?: ReactNode
  /** The orange action: "Make a new one like these", "Add 3 to Your assets". */
  actionLabel: string
  onAction: () => void
  /** Greys the action and keeps it focusable; say why with `actionHint`. */
  actionDisabled?: boolean
  actionHint?: string
  actionLoading?: boolean
  onClear: () => void
  clearLabel?: string
  className?: string
}

/** The dark bar over a grid: "{n} selected", a hint, Clear and the action. */
export function SelectionBar({
  count,
  hint,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionHint,
  actionLoading = false,
  onClear,
  clearLabel = 'Clear',
  className
}: SelectionBarProps) {
  return (
    <section className={cx('as-selbar', className)} aria-label="Selection">
      <p className="as-selbar__text">
        <strong role="status" className="as-selbar__count">{`${count} selected`}</strong>
        {hint && <span className="as-selbar__hint">{hint}</span>}
      </p>
      <div className="as-selbar__actions">
        <Button
          variant="secondary"
          size="md"
          shape="pill"
          className="as-selbar__clear"
          onClick={onClear}
        >
          {clearLabel}
        </Button>
        <Button
          variant="primary"
          size="md"
          shape="pill"
          loading={actionLoading}
          aria-disabled={actionDisabled || undefined}
          title={actionDisabled ? actionHint : undefined}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      </div>
    </section>
  )
}
