import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { Toast } from './Toast'
import {
  createToast,
  pushToast,
  removeToast,
  type ToastItem,
  type ToastOptions
} from './toastState'
import './Toast.css'

export interface ToastApi {
  /** Show a toast; returns its id. */
  show(options: ToastOptions): string
  /** Close a toast early. */
  dismiss(id: string): void
}

const ToastContext = createContext<ToastApi | null>(null)

/** Show toasts from anywhere: `const toast = useToast(); toast.show({ message: 'Saved' })`. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast() must be used inside <ToastProvider>')
  return api
}

/** Mount once near the root. Renders the notification area (bottom centre, polite live region). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: string) => setToasts((list) => removeToast(list, id)), [])
  const show = useCallback((options: ToastOptions) => {
    counter.current += 1
    const toast = createToast(`toast-${counter.current}`, options)
    setToasts((list) => pushToast(list, toast))
    return toast.id
  }, [])
  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="ui-toasts" role="region" aria-label="Notifications" aria-live="polite">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}
