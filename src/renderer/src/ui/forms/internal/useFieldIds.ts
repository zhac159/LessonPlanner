import { useId } from 'react'

export interface FieldIds {
  id: string
  hintId: string
  errorId: string
}

/** Stable ids for a field and its help/error text (the caller's `id` wins). */
export function useFieldIds(idProp?: string): FieldIds {
  const auto = useId()
  const id = idProp ?? auto
  return { id, hintId: `${id}-hint`, errorId: `${id}-error` }
}

/** The `aria-describedby` value: the visible message (error beats hint) plus any caller ids. */
export function describedBy(
  ids: FieldIds,
  message: { hint?: string; error?: string },
  extra?: string
): string | undefined {
  const own = message.error ? ids.errorId : message.hint ? ids.hintId : undefined
  const joined = [own, extra].filter(Boolean).join(' ')
  return joined || undefined
}
