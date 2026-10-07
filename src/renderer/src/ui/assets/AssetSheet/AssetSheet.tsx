import { ChevronLeft, X } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'
import { CardHeaderBand, type BandTone } from '../../atoms/CardHeaderBand/CardHeaderBand'
import { IconButton } from '../../atoms/IconButton/IconButton'
import { cx } from '../../atoms/cx'
import './AssetSheet.css'

export interface AssetSheetProps {
  title: string
  subtitle?: ReactNode
  /** The ‹ button. Leave out when there is nothing to go back to. */
  onBack?: () => void
  backLabel?: string
  /** The × button of the `card` variant. */
  onClose?: () => void
  /** The orange round badge at the right of the band (the region number). */
  badge?: ReactNode
  /** band = the A11/A13 sheet with a coloured header band; card = the A4 card above the composer. */
  variant?: 'band' | 'card'
  tone?: BandTone
  /** Esc anywhere in the sheet (unless something inside already used it). */
  onEscape?: () => void
  /** Ctrl+Enter: the primary action of the footer. */
  onSubmitShortcut?: () => void
  /** Accessible name of the dialog; defaults to the title. */
  label?: string
  children: ReactNode
  /** The sticky footer: Cancel / Skip and the primary button. */
  footer?: ReactNode
  className?: string
}

/**
 * The side sheet that replaces the chat panel's content (A11, A13) or, as a `card`, floats over the chat above the
 * Composer (A4). A non-modal dialog: header, a scrolling body and an optional sticky footer.
 */
export function AssetSheet({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  onClose,
  badge,
  variant = 'band',
  tone = 'mint',
  onEscape,
  onSubmitShortcut,
  label,
  children,
  footer,
  className
}: AssetSheetProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.defaultPrevented) return
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault()
      onEscape()
    } else if (event.key === 'Enter' && event.ctrlKey && onSubmitShortcut) {
      event.preventDefault()
      onSubmitShortcut()
    }
  }
  const back = onBack && (
    <IconButton aria-label={backLabel} onClick={onBack}>
      <ChevronLeft strokeWidth={2.4} />
    </IconButton>
  )
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={label ?? title}
      className={cx('as-sheet', className)}
      data-variant={variant}
      onKeyDown={onKeyDown}
    >
      {variant === 'band' ? (
        <CardHeaderBand
          tone={tone}
          leading={back}
          title={title}
          subtitle={subtitle}
          trailing={badge && <span className="as-sheet__badge">{badge}</span>}
        />
      ) : (
        <header className="as-sheet__head">
          {back}
          <h2 className="as-sheet__title">{title}</h2>
          {onClose && (
            <IconButton aria-label="Close" onClick={onClose}>
              <X strokeWidth={2.4} />
            </IconButton>
          )}
        </header>
      )}
      <div className="as-sheet__body">{children}</div>
      {footer && <footer className="as-sheet__footer">{footer}</footer>}
    </section>
  )
}
