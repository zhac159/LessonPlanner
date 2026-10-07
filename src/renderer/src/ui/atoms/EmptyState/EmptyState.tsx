import type { ReactNode } from 'react'
import { cx } from '../cx'
import { IconTile } from '../IconTile/IconTile'
import './EmptyState.css'

export interface EmptyStateProps {
  /** An unsized lucide icon for the tile. */
  icon: ReactNode
  /** What will appear here: "Your slides will appear here". */
  title: string
  /** One way to start. */
  children?: ReactNode
  /** Secondary pill Buttons. */
  actions?: ReactNode
  /** stage = 16:9 dashed canvas stand-in, list = compact block inside a card. */
  variant?: 'stage' | 'list'
  className?: string
}

/** A dashed box that says what will appear and offers a way to start. */
export function EmptyState({
  icon,
  title,
  children,
  actions,
  variant = 'stage',
  className
}: EmptyStateProps) {
  return (
    <section className={cx('ui-empty', className)} data-variant={variant} aria-label={title}>
      <IconTile size={variant === 'stage' ? 76 : 52} tone="yellow">
        {icon}
      </IconTile>
      <h2 className="ui-empty__title">{title}</h2>
      {children && <p className="ui-empty__body">{children}</p>}
      {actions && <div className="ui-empty__actions">{actions}</div>}
    </section>
  )
}
