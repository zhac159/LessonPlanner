import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Callout, IconButton } from '@ui/atoms'
import { TextField } from '@ui/forms'
import './sheets.css'

export interface SavedAsLineProps {
  /** The name it will be saved under (`leaf_in_sunlight`). */
  name: string
  onNameChange(name: string): void
  /** The message of the name check; the field shows it in place. */
  error?: string
  /** The picture's licence asks for a credit in the slide notes. */
  withCredit: boolean
}

/** "It’ll also be saved to Your assets as `leaf_in_sunlight`, with its credit in the slide notes." and a pencil to rename. */
export function SavedAsLine({ name, onNameChange, error, withCredit }: SavedAsLineProps) {
  const [editing, setEditing] = useState(false)
  return (
    <Callout variant="info">
      <span className="deck-spot__saved">
        <span>
          It’ll also be saved to Your assets as <code>{name}</code>
          {withCredit ? ', with its credit in the slide notes.' : '.'}
        </span>
        <IconButton
          variant="ghost"
          aria-label="Change the saved name"
          aria-expanded={editing}
          onClick={() => setEditing(!editing)}
        >
          <Pencil aria-hidden="true" />
        </IconButton>
      </span>
      {editing && (
        <TextField
          label="Name in chat"
          strongLabel
          value={name}
          error={error}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && !error && setEditing(false)}
        />
      )}
    </Callout>
  )
}
