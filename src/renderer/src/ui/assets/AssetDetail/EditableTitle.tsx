import { useEffect, useState, type KeyboardEvent } from 'react'
import { cx } from '../../atoms/cx'
import './EditableTitle.css'

export const TITLE_MAX = 60

export interface EditableTitleProps {
  value: string
  onCommit: (title: string) => void
  className?: string
}

/** The pane's heading: "School logo". A plain input that looks like the heading; saves on blur or Enter (60 characters). */
export function EditableTitle({ value, onCommit, className }: EditableTitleProps) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const commit = (): void => {
    const next = draft.trim()
    if (!next) setDraft(value)
    else if (next !== value) onCommit(next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      setDraft(value)
    }
  }
  return (
    <input
      className={cx('as-title-input', className)}
      aria-label="Title"
      value={draft}
      maxLength={TITLE_MAX}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  )
}
