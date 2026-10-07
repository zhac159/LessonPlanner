import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@ui/atoms'
import { TextField } from '@ui/forms'
import { Dialog } from '@ui/overlays'

export interface RenameLessonDialogProps {
  /** The lesson's current title, or null while the dialog is closed. */
  title: string | null
  busy: boolean
  /** Why the last save failed. */
  error: string | null
  onSave(title: string): void
  onCancel(): void
}

/** "Rename lesson": the title starts selected; Enter saves, Esc cancels, an empty title is not allowed. */
export function RenameLessonDialog({
  title,
  busy,
  error,
  onSave,
  onCancel
}: RenameLessonDialogProps) {
  const open = title !== null
  const [value, setValue] = useState(title ?? '')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (title === null) return
    setValue(title)
    // Wait for the dialog to mount its focus scope, then select the text.
    const timer = setTimeout(() => input.current?.select(), 0)
    return () => clearTimeout(timer)
  }, [title])

  const valid = value.trim().length > 0
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (valid && !busy) onSave(value)
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Rename lesson"
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="home-rename-form"
            disabled={!valid}
            loading={busy}
          >
            Save
          </Button>
        </>
      }
    >
      <form id="home-rename-form" onSubmit={submit}>
        <TextField
          ref={input}
          label="Lesson title"
          data-autofocus
          value={value}
          error={error ?? undefined}
          maxLength={120}
          onChange={(event) => setValue(event.target.value)}
        />
      </form>
    </Dialog>
  )
}
