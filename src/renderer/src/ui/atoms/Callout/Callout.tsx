import { CircleAlert, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../cx'
import { IconButton } from '../IconButton/IconButton'
import './Callout.css'

export type CalloutVariant = 'info' | 'soft' | 'tip' | 'action' | 'warning' | 'error'

export interface CalloutProps {
  /**
   * info = lilac box with a title, soft = lilac note with a bold lead-in, tip = dashed hint pill,
   * action = butter row with a button, warning = yellow-ish heads-up, error = peach (role alert).
   */
  variant?: CalloutVariant
  /** Bold first line. */
  title?: ReactNode
  /** Leading icon. Errors and warnings get one by default. */
  icon?: ReactNode
  /** A Button shown at the end (the `action` variant's "Connect Claude"). */
  action?: ReactNode
  /** Shows a close button (dismissible tips). */
  onDismiss?: () => void
  children?: ReactNode
  className?: string
}

const DEFAULT_ICON: Partial<Record<CalloutVariant, ReactNode>> = {
  error: <CircleAlert size={18} aria-hidden="true" />,
  warning: <TriangleAlert size={18} aria-hidden="true" />
}

/** A boxed message. Info explains, tip hints at the tool, action asks, error says what went wrong. */
export function Callout({
  variant = 'info',
  title,
  icon,
  action,
  onDismiss,
  children,
  className
}: CalloutProps) {
  const lead = icon ?? DEFAULT_ICON[variant]
  return (
    <div
      className={cx('ui-callout', className)}
      data-variant={variant}
      role={variant === 'error' ? 'alert' : 'note'}
    >
      {lead && <span className="ui-callout__icon">{lead}</span>}
      <div className="ui-callout__body">
        {title && <p className="ui-callout__title">{title}</p>}
        {children && <div className="ui-callout__text">{children}</div>}
      </div>
      {action && <div className="ui-callout__action">{action}</div>}
      {onDismiss && (
        <IconButton aria-label="Dismiss" variant="ghost" onClick={onDismiss}>
          <X strokeWidth={2.2} />
        </IconButton>
      )}
    </div>
  )
}
