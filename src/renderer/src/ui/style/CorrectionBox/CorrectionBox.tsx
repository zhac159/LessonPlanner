import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button, StatusPill, cx } from '../../atoms'
import { TextField } from '../../forms'
import './CorrectionBox.css'

export interface PastCorrection {
  text: string
  /** ISO timestamp. */
  at: string
}

export interface CorrectionBoxProps {
  /** The text in the field. Controlled, so the screen can clear it on success and keep it on error. */
  value: string
  onChange: (text: string) => void
  /** Called with the trimmed text on "Tell me", Enter or Ctrl+Enter. Never called while empty or busy. */
  onSubmit: (text: string) => void
  /** Claude is applying the correction: the field is disabled and the button reads "Updating…". */
  busy?: boolean
  /** The AI error copy shown under the box. The text stays in the field. */
  error?: string
  /** Claude's one-line message after a successful correction; hides itself after `confirmationMs`. */
  confirmation?: string
  confirmationMs?: number
  /** Earlier corrections, oldest first (as stored); listed newest first under "Your corrections". */
  corrections?: readonly PastCorrection[]
  className?: string
}

/** "Anything I got wrong?": a dashed box where she tells Claude what the learned style gets wrong. */
export function CorrectionBox({
  value,
  onChange,
  onSubmit,
  busy = false,
  error,
  confirmation,
  confirmationMs = 4000,
  corrections = [],
  className
}: CorrectionBoxProps) {
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const listId = useId()
  const text = value.trim()
  const canSubmit = text.length > 0 && !busy

  useEffect(() => {
    if (!confirmation) return
    const timer = setTimeout(() => setDismissed(confirmation), confirmationMs)
    return () => clearTimeout(timer)
  }, [confirmation, confirmationMs])

  const submit = (): void => {
    if (canSubmit) onSubmit(text)
  }
  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault()
    submit()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>): void => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      submit()
    }
  }

  const showConfirmation = Boolean(confirmation) && dismissed !== confirmation
  const newestFirst = [...corrections].reverse()

  return (
    <form
      className={cx('correction-box', className)}
      aria-label="Anything I got wrong?"
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      <p className="correction-box__label" aria-hidden="true">
        Anything I got wrong?
      </p>
      <div className="correction-box__row">
        <TextField
          className="correction-box__field"
          label="Anything I got wrong?"
          hideLabel
          size="lg"
          placeholder="e.g. I never use yellow on title slides"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={busy}
          error={error}
        />
        <Button
          type="submit"
          variant="dark"
          size="lg"
          className="correction-box__button"
          disabled={!canSubmit && !busy}
          loading={busy}
          loadingLabel="Updating…"
        >
          Tell me
        </Button>
      </div>
      <div className="correction-box__status" role="status">
        {showConfirmation && (
          <StatusPill tone="done" check size="md">
            {confirmation}
          </StatusPill>
        )}
      </div>
      {corrections.length > 0 && (
        <div className="correction-box__history">
          <button
            type="button"
            className="correction-box__toggle"
            aria-expanded={listOpen}
            aria-controls={listId}
            onClick={() => setListOpen((open) => !open)}
          >
            Your corrections ({corrections.length})
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {listOpen && (
            <ul id={listId} className="correction-box__list">
              {newestFirst.map((item, index) => (
                <li key={`${item.at}-${index}`}>
                  <time dateTime={item.at}>{formatDay(item.at)}</time>
                  {item.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  )
}

/** "6 Oct", or an empty string for an unreadable timestamp. */
function formatDay(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
