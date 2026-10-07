import { useState, type KeyboardEvent } from 'react'
import { TextField } from '@ui/forms'
import { MAX_TITLE_LENGTH } from '../buildRequest'

export interface LessonTitleFieldProps {
  /** The title as last committed; empty shows "Untitled lesson". */
  value: string
  /** Enter or leaving the field commits the text. */
  onCommit(title: string): void
}

/**
 * The lesson title in the header (05 §8.6): click or Tab in to type, Enter or leaving commits, Esc puts
 * back what was there. Before the lesson exists the title only lives on this screen.
 */
export function LessonTitleField({ value, onCommit }: LessonTitleFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? value

  const commit = (): void => {
    if (draft !== null && draft !== value) onCommit(draft.trim())
    setDraft(null)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
      event.currentTarget.blur()
    } else if (event.key === 'Escape' && draft !== null) {
      event.stopPropagation()
      setDraft(null)
    }
  }

  return (
    <TextField
      variant="title"
      label="Lesson title"
      placeholder="Untitled lesson"
      maxLength={MAX_TITLE_LENGTH}
      value={shown}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
    />
  )
}
