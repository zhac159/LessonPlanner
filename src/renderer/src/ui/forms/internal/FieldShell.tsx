import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from './cx'
import type { FieldIds } from './useFieldIds'
import './forms.css'

export interface FieldShellProps {
  ids: FieldIds
  label: string
  /** Visually hide the label (it stays the accessible name). */
  hideLabel?: boolean
  /** The prominent 15/800 label. */
  strongLabel?: boolean
  /** `inline` puts the label to the left of the control (Sort). */
  labelPosition?: 'above' | 'inline'
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}

/** Label above (or beside) a control, with help or error text below it. */
export function FieldShell({
  ids,
  label,
  hideLabel,
  strongLabel,
  labelPosition = 'above',
  hint,
  error,
  className,
  children
}: FieldShellProps): ReactNode {
  const inline = labelPosition === 'inline'
  return (
    <div className={cx('fk-shell', className)}>
      <div className={cx('fk-shell__row', inline && 'fk-shell__row--inline')}>
        <label
          htmlFor={ids.id}
          className={cx(
            'fk-label',
            strongLabel && 'fk-label--strong',
            inline && 'fk-label--inline',
            hideLabel && 'fk-sr-only'
          )}
        >
          {label}
        </label>
        {children}
      </div>
      {error ? (
        <p id={ids.errorId} className="fk-message fk-message--error">
          <CircleAlert size={16} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={ids.hintId} className="fk-message">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
