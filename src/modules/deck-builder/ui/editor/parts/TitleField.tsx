import { useRef, useState, type KeyboardEvent } from 'react'
import { TextField } from '@ui/forms'

export const MAX_TITLE = 80

export interface TitleFieldProps {
  title: string
  /** Locked while slides are being made. */
  disabled?: boolean
  /** Enter or blur with a new, non-empty title. */
  onCommit(title: string): void
}

/**
 * The lesson title in the header (06 §8.8): plain text that shows its dashed field on hover and focus. Enter or
 * blur saves, Esc goes back, an empty title restores the old one.
 */
export function TitleField({ title, disabled, onCommit }: TitleFieldProps) {
  const [draft, setDraft] = useState(title)
  const reverting = useRef(false)

  // A new title from outside replaces the draft while rendering, not in an effect: an effect runs after the first
  // paint and would overwrite what the teacher typed if they start typing before it has run.
  const [seen, setSeen] = useState(title)
  if (seen !== title) {
    setSeen(title)
    setDraft(title)
  }

  const finish = (): void => {
    if (reverting.current) {
      reverting.current = false
      setDraft(title)
      return
    }
    const next = draft.replace(/\s+/g, ' ').trim()
    if (!next || next === title) setDraft(title)
    else onCommit(next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      event.stopPropagation()
      reverting.current = true
      event.currentTarget.blur()
    }
  }

  return (
    <TextField
      variant="title"
      label="Lesson title"
      value={draft}
      title={title}
      maxLength={MAX_TITLE}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={finish}
      onKeyDown={onKeyDown}
    />
  )
}
