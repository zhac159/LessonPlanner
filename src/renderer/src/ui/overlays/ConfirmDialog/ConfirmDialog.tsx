import type { ReactNode } from 'react'
import { Button } from '../../atoms/Button/Button'
import { Dialog } from '../Dialog/Dialog'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  /** What will happen, in plain words. */
  message: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** For deletions: focus starts on Cancel so Enter cannot destroy anything by accident. */
  destructive?: boolean
  /** The confirmed action is running: both buttons wait and the dialog cannot be dismissed. */
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** "Delete lesson?" style question with Cancel and a confirm button. Esc and backdrop cancel. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={busy}
            data-autofocus={destructive ? '' : undefined}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={busy}
            data-autofocus={destructive ? undefined : ''}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
