import { Copy, Minus, Square, X } from 'lucide-react'
import { cx } from '../../atoms/cx'
import { AppMark } from '../AppMark/AppMark'
import './TitleBar.css'

export interface TitleBarProps {
  /** Wordmark text, e.g. "Slide Planner". */
  title: string
  /** Over the splash: transparent, no rule, brand hidden. Only the window buttons remain. */
  floating?: boolean
  /** The window is maximised, so the middle button restores. */
  maximized: boolean
  /** The window has lost focus: wordmark and icons turn muted. */
  inactive?: boolean
  onMinimize: () => void
  onToggleMaximize: () => void
  onClose: () => void
  className?: string
}

/**
 * The frameless window's title bar: brand on the left (drag area), caption buttons on the right.
 * Purely presentational: the app wires the callbacks to the real window.
 */
export function TitleBar({
  title,
  floating = false,
  maximized,
  inactive = false,
  onMinimize,
  onToggleMaximize,
  onClose,
  className
}: TitleBarProps) {
  return (
    <header
      className={cx('ui-titlebar', className)}
      data-floating={floating}
      data-inactive={inactive || undefined}
      data-testid="titlebar"
    >
      <div className="ui-titlebar__brand">
        <AppMark />
        <span className="ui-titlebar__name">{title}</span>
      </div>
      <div className="ui-titlebar__controls">
        <button
          type="button"
          className="ui-titlebar__btn"
          aria-label="Minimise"
          data-testid="window-minimize"
          onClick={onMinimize}
        >
          <Minus size={14} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ui-titlebar__btn"
          aria-label={maximized ? 'Restore' : 'Maximise'}
          data-testid="window-maximize"
          onClick={onToggleMaximize}
        >
          {maximized ? (
            <Copy size={13} strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <Square size={13} strokeWidth={2.2} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="ui-titlebar__btn ui-titlebar__btn--close"
          aria-label="Close"
          data-testid="window-close"
          onClick={onClose}
        >
          <X size={14} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
