import { X } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { Button } from '../../atoms/Button/Button'
import { IconButton } from '../../atoms/IconButton/IconButton'
import type { ToastItem } from './toastState'
import './Toast.css'

interface ToastProps {
  toast: ToastItem
  onDismiss: (id: string) => void
}

/**
 * One toast. Its timer pauses while the pointer or keyboard focus is on it, so there is always
 * time to press "Undo", and restarts in full afterwards.
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { id, durationMs } = toast

  const start = useCallback((): void => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onDismiss(id), durationMs)
  }, [id, durationMs, onDismiss])
  const pause = (): void => clearTimeout(timer.current)

  useEffect(() => {
    start()
    return () => clearTimeout(timer.current)
  }, [start])

  return (
    <div
      className="ui-toast"
      data-tone={toast.tone ?? 'default'}
      role={toast.tone === 'error' ? 'alert' : undefined}
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
    >
      <span className="ui-toast__message">{toast.message}</span>
      {toast.action && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            toast.action?.onAction()
            onDismiss(id)
          }}
        >
          {toast.action.label}
        </Button>
      )}
      <IconButton aria-label="Dismiss" variant="ghost" onClick={() => onDismiss(id)}>
        <X strokeWidth={2.2} />
      </IconButton>
    </div>
  )
}
