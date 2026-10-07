import { Checkbox, TextField } from '@ui/forms'
import { NAME_MAX, type StyleIdentity } from '../hooks/useStyleIdentity'

export interface NameRowProps {
  identity: StyleIdentity
}

/** "Style name" and "Make this my default style" (04 §3). */
export function NameRow({ identity }: NameRowProps) {
  return (
    <div className="cs-name">
      <TextField
        ref={identity.nameRef}
        className="cs-name__field"
        label="Style name"
        strongLabel
        strongValue
        size="lg"
        placeholder="Name this style"
        maxLength={NAME_MAX}
        value={identity.name}
        error={identity.nameError}
        onChange={(event) => identity.setName(event.target.value)}
      />
      <Checkbox
        emphasis
        label="Make this my default style"
        checked={identity.isDefault}
        onChange={identity.setIsDefault}
      />
    </div>
  )
}
