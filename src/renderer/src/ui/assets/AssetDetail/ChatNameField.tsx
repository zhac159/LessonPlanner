import { useEffect, useState, type KeyboardEvent } from 'react'
import { ASSET_NAME_MAX } from '@shared/assets/names'
import { cx } from '../../atoms/cx'
import { TextField } from '../../forms/TextField/TextField'
import './ChatNameField.css'

export interface ChatNameFieldProps {
  /** The saved name. */
  value: string
  /** Every keystroke, so the caller can check the name (150 ms after the last key). */
  onDraftChange?: (draft: string) => void
  /** Blur or Enter with a changed draft. The caller validates and may answer with `error`. */
  onCommit: (draft: string) => void
  /** The message of the name check; replaces the helper and turns the field red. */
  error?: string
  /** A check is running. */
  checking?: boolean
  label?: string
  /** Helper under the field; defaults to the A1 sentence about `{{name}}`. */
  hint?: string
  className?: string
}

/** "Name in chat": a mono field that saves on blur or Enter and explains a bad name in place. Esc goes back to the saved name. */
export function ChatNameField({
  value,
  onDraftChange,
  onCommit,
  error,
  checking = false,
  label = 'Name in chat',
  hint,
  className
}: ChatNameFieldProps) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const change = (next: string): void => {
    setDraft(next)
    onDraftChange?.(next)
  }
  const commit = (): void => {
    if (draft !== value) onCommit(draft)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape' && draft !== value) {
      event.stopPropagation()
      change(value)
    }
  }

  return (
    <TextField
      label={label}
      strongLabel
      className={cx('as-name-field', className)}
      value={draft}
      maxLength={ASSET_NAME_MAX + 8}
      spellCheck={false}
      autoComplete="off"
      loading={checking}
      error={error}
      hint={hint ?? `Type {{${value}}} in the chat, or pick it from + › Add asset.`}
      onChange={(event) => change(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  )
}
