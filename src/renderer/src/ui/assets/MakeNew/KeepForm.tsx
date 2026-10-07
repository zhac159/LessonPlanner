import { useId } from 'react'
import { Button } from '../../atoms/Button/Button'
import { cx } from '../../atoms/cx'
import { TextField } from '../../forms/TextField/TextField'
import './KeepForm.css'

export interface KeepFormProps {
  /** The chosen version's number; null while none is chosen. */
  version: number | null
  /** "Keep" saves it to Your assets (A8); "Use" places it (A13). */
  verb?: 'Keep' | 'Use'
  name: string
  onNameChange: (name: string) => void
  /** The message of the name check; Keep stays off while there is one. */
  nameError?: string
  onKeep: () => void
  onTryAgain: () => void
  busy?: boolean
  className?: string
}

/** "Name in chat" and the two buttons under the versions: "Keep version 3" and "Try again". */
export function KeepForm({
  version,
  verb = 'Keep',
  name,
  onNameChange,
  nameError,
  onKeep,
  onTryAgain,
  busy = false,
  className
}: KeepFormProps) {
  const reasonId = useId()
  const reason =
    version === null ? 'Pick a version first.' : nameError ? 'Fix the name first.' : undefined
  return (
    <div className={cx('as-keep', className)}>
      <TextField
        label="Name in chat"
        strongLabel
        className="as-keep__name"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        error={nameError}
        spellCheck={false}
        autoComplete="off"
      />
      <div className="as-keep__actions">
        <Button
          variant="primary"
          loading={busy}
          aria-disabled={reason ? true : undefined}
          aria-describedby={reason ? reasonId : undefined}
          onClick={onKeep}
        >
          {version === null ? `${verb} a version` : `${verb} version ${version}`}
        </Button>
        <Button variant="secondary" onClick={onTryAgain}>
          Try again
        </Button>
      </div>
      {reason && (
        <p id={reasonId} className="as-sr-only">
          {reason}
        </p>
      )}
    </div>
  )
}
