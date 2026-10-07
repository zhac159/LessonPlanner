import { Button } from '../../atoms/Button/Button'
import { FileTypeBadge } from '../../atoms/FileTypeBadge/FileTypeBadge'
import { ProgressBar } from '../../atoms/ProgressBar/ProgressBar'
import { StatusPill } from '../../atoms/StatusPill/StatusPill'
import { TextLink } from '../../atoms/TextLink/TextLink'
import { cx } from '../../atoms/cx'
import { foundCountLabel } from '../internal/format'
import './ReviewFileRow.css'

export interface ReviewFileRowProps {
  fileName: string
  state: 'waiting' | 'working' | 'done' | 'failed'
  /** Pictures found so far. */
  found?: number
  /** While working: "Cutting out pictures · page 4 of 6". */
  progress?: { done: number; total: number; label: string }
  /** A failed file: why ("This PDF is only scanned pages, so there's nothing to cut out."). */
  error?: string
  onRetry?: () => void
  className?: string
}

/** A row of "Where I looked": the file's badge and name, then "4 found", a progress bar or "Couldn't read" + "Try again". */
export function ReviewFileRow({
  fileName,
  state,
  found = 0,
  progress,
  error,
  onRetry,
  className
}: ReviewFileRowProps) {
  return (
    <li className={cx('as-filerow', className)} data-state={state}>
      <div className="as-filerow__top">
        <FileTypeBadge fileName={fileName} />
        <span className="as-filerow__name">{fileName}</span>
        {state === 'done' && <span className="as-filerow__found">{foundCountLabel(found)}</span>}
        {state === 'waiting' && <span className="as-filerow__found">Waiting</span>}
        {state === 'failed' && <StatusPill tone="error">{"Couldn't read"}</StatusPill>}
      </div>
      {state === 'working' && progress && (
        <ProgressBar value={progress.done} max={progress.total} label={progress.label} />
      )}
      {state === 'failed' && (
        <p className="as-filerow__error">
          {error && <span>{error}</span>}
          {onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
        </p>
      )}
    </li>
  )
}

export interface ReviewMoreRowProps {
  /** Decks hidden in the row: "+5" and "5 more decks". */
  count: number
  found: number
  expanded?: boolean
  onToggle: () => void
}

/** The collapsed row "+5  5 more decks  3 found"; click to show them. */
export function ReviewMoreRow({ count, found, expanded = false, onToggle }: ReviewMoreRowProps) {
  return (
    <li className="as-filerow as-filerow--more">
      <Button
        variant="ghost"
        className="as-filerow__more"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="as-filerow__plus">{`+${count}`}</span>
        <span className="as-filerow__name">{`${count} more ${count === 1 ? 'deck' : 'decks'}`}</span>
        <span className="as-filerow__found">{foundCountLabel(found)}</span>
      </Button>
    </li>
  )
}
