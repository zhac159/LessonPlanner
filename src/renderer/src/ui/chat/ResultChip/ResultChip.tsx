import { cx } from '../../atoms/cx'
import { Button } from '../../atoms/Button/Button'
import { Tooltip } from '../../atoms/Tooltip/Tooltip'
import './ResultChip.css'

/** Shown on the disabled Undo of a change that is not the latest one. */
export const UNDO_BLOCKED_HINT = 'Undo the later changes first'

export interface ResultChipProps {
  /** What changed: "8 slides added", "Slide 3 changed". */
  label: string
  /** After Undo the pill reads "Undone" and the action becomes Redo. */
  undone?: boolean
  /** Undo is only allowed on the latest change: false shows it disabled with a hint. */
  canUndo?: boolean
  /** A request is in flight: the Undo / Redo button shows a spinner and ignores clicks. */
  busy?: boolean
  onUndo?: () => void
  /** Without it an undone chip shows a disabled "Undo". */
  onRedo?: () => void
  /** Adds a "Refine in chat" button (not shown once undone). */
  onRefine?: () => void
  /** Makes the pill a button that selects the first affected slide. */
  onSelect?: () => void
  /** Hover / focus on the chip, to outline the affected thumbnails. */
  onHighlight?: (on: boolean) => void
  className?: string
}

/** "8 slides added" with Undo (and Redo) under an assistant message. */
export function ResultChip({
  label,
  undone = false,
  canUndo = true,
  busy = false,
  onUndo,
  onRedo,
  onRefine,
  onSelect,
  onHighlight,
  className
}: ResultChipProps) {
  const text = undone ? 'Undone' : label
  const pill = onSelect ? (
    <button type="button" className="ui-result__pill" onClick={onSelect}>
      {text}
    </button>
  ) : (
    <span className="ui-result__pill">{text}</span>
  )

  let action
  if (undone && onRedo) {
    action = (
      <Button size="sm" loading={busy} onClick={onRedo}>
        Redo
      </Button>
    )
  } else if (undone) {
    action = (
      <Button size="sm" disabled>
        Undo
      </Button>
    )
  } else if (!canUndo) {
    action = (
      <Tooltip label={UNDO_BLOCKED_HINT}>
        <Button size="sm" aria-disabled="true">
          Undo
        </Button>
      </Tooltip>
    )
  } else {
    action = (
      <Button size="sm" loading={busy} disabled={!onUndo} onClick={onUndo}>
        Undo
      </Button>
    )
  }

  return (
    <div
      className={cx('ui-result', className)}
      data-state={undone ? 'undone' : 'done'}
      onMouseEnter={() => onHighlight?.(true)}
      onMouseLeave={() => onHighlight?.(false)}
      onFocus={() => onHighlight?.(true)}
      onBlur={() => onHighlight?.(false)}
    >
      {pill}
      {action}
      {onRefine && !undone && (
        <Button size="sm" onClick={onRefine}>
          Refine in chat
        </Button>
      )}
    </div>
  )
}
