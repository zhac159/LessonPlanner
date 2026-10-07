import { X } from 'lucide-react'
import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from '../../atoms/IconButton/IconButton'
import { useEscape, useFocusScope } from '../internal/focus'
import './Dialog.css'

export interface DialogProps {
  open: boolean
  /** Called for Esc, the close button and a click on the backdrop. */
  onClose: () => void
  title: string
  /** Optional lead text under the title; also the dialog's accessible description. */
  description?: ReactNode
  children?: ReactNode
  /** Buttons row. Put the main action last. */
  footer?: ReactNode
  /** Backdrop clicks close the dialog (default). Turn off while work is in progress. */
  dismissible?: boolean
  size?: 'sm' | 'md'
}

/**
 * A modal dialog: focus is trapped inside, Esc closes it, and focus returns to what opened it.
 * Give interactive children `data-autofocus` to choose the starting control.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  size = 'md'
}: DialogProps) {
  const titleId = useId()
  const descId = useId()
  const panel = useRef<HTMLDivElement>(null)
  useFocusScope(panel, open, { trap: true, prefer: '.ui-dialog__body' })
  useEscape(open && dismissible, onClose)

  if (!open) return null
  return createPortal(
    <div
      className="ui-dialog__backdrop"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        className="ui-dialog"
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <div className="ui-dialog__head">
          <h2 id={titleId} className="ui-dialog__title">
            {title}
          </h2>
          {dismissible && (
            <IconButton aria-label="Close" variant="ghost" onClick={onClose}>
              <X strokeWidth={2.2} />
            </IconButton>
          )}
        </div>
        {description && (
          <p id={descId} className="ui-dialog__description">
            {description}
          </p>
        )}
        {children && <div className="ui-dialog__body">{children}</div>}
        {footer && <div className="ui-dialog__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
