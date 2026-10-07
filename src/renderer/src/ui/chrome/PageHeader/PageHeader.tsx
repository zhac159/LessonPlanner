import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../../atoms/Button/Button'
import { cx } from '../../atoms/cx'
import './PageHeader.css'

export interface PageHeaderProps {
  /**
   * greeting = Home (no bar, big title), bar = secondary pages (white bar with a rule),
   * editor = lesson screens (back pill, centred title, actions), steps = onboarding progress.
   */
  variant: 'greeting' | 'bar' | 'editor' | 'steps'
  /** The page's h1 (greeting, bar). */
  title?: ReactNode
  /** Line under the greeting title. */
  subtitle?: ReactNode
  /** Back pill, labelled with where it goes ("Home", "My lessons"). */
  back?: { label: string; onClick: () => void }
  /** A StatusPill beside the actions (bar). */
  status?: ReactNode
  /** Centred content (editor): the lesson title or its text field. */
  center?: ReactNode
  /** Buttons, search field, progress pills: whatever sits at the right. */
  actions?: ReactNode
  className?: string
}

/** The top row of a screen. One component, four layouts from the design system. */
export function PageHeader({
  variant,
  title,
  subtitle,
  back,
  status,
  center,
  actions,
  className
}: PageHeaderProps) {
  const backButton = back && (
    <Button
      shape="pill"
      icon={<ChevronLeft strokeWidth={2.4} />}
      onClick={back.onClick}
      className="ui-page-header__back"
    >
      {back.label}
    </Button>
  )

  return (
    <header className={cx('ui-page-header', className)} data-variant={variant}>
      {variant === 'greeting' ? (
        <div className="ui-page-header__titles">
          <h1 className="ui-page-header__title">{title}</h1>
          {subtitle && <p className="ui-page-header__subtitle">{subtitle}</p>}
        </div>
      ) : (
        <>
          {backButton}
          {variant === 'bar' && <h1 className="ui-page-header__title">{title}</h1>}
          {variant === 'editor' && <div className="ui-page-header__center">{center}</div>}
          {variant !== 'editor' && <div className="ui-page-header__spacer" />}
          {status}
        </>
      )}
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  )
}
