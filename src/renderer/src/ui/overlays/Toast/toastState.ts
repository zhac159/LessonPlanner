/** Pure state for the toast stack: easy to reason about and to test without React. */

export interface ToastAction {
  label: string
  /** Runs when the button is pressed; the toast then closes. */
  onAction: () => void
}

export interface ToastOptions {
  message: string
  /** One optional button, e.g. "Undo" or "Open in PowerPoint". */
  action?: ToastAction
  /** How long it stays. Default 4 s, or 6 s when it has an action (time to read and press). */
  durationMs?: number
  /** `error` is announced assertively. */
  tone?: 'default' | 'error'
}

export interface ToastItem extends ToastOptions {
  id: string
  durationMs: number
}

export const DEFAULT_DURATION_MS = 4000
export const ACTION_DURATION_MS = 6000
/** The most toasts on screen at once: the oldest one makes room. */
export const MAX_TOASTS = 3

/** Fill in defaults and an id. */
export function createToast(id: string, options: ToastOptions): ToastItem {
  return {
    ...options,
    id,
    durationMs: options.durationMs ?? (options.action ? ACTION_DURATION_MS : DEFAULT_DURATION_MS)
  }
}

/** Add a toast, dropping the oldest ones beyond MAX_TOASTS. */
export function pushToast(list: ReadonlyArray<ToastItem>, toast: ToastItem): ToastItem[] {
  return [...list, toast].slice(-MAX_TOASTS)
}

/** Remove a toast by id (unknown ids are ignored). */
export function removeToast(list: ReadonlyArray<ToastItem>, id: string): ToastItem[] {
  return list.filter((toast) => toast.id !== id)
}
