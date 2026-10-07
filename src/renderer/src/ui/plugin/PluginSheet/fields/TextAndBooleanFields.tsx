import { Checkbox } from '../../../forms/Checkbox/Checkbox'
import { TextArea } from '../../../forms/TextArea/TextArea'
import { TextField } from '../../../forms/TextField/TextField'
import type { FieldProps } from './types'

/** A `text` input: a TextField, or a TextArea when the manifest says `multiline`. */
export function TextInputField({ input, value, onChange, error }: FieldProps<'text', string>) {
  const common = {
    label: input.label,
    strongLabel: true,
    placeholder: input.placeholder,
    maxLength: input.maxLength,
    required: input.required,
    value,
    error
  }
  return input.multiline ? (
    <TextArea {...common} rows={3} onChange={(event) => onChange(event.target.value)} />
  ) : (
    <TextField {...common} onChange={(event) => onChange(event.target.value)} />
  )
}

/** A `boolean` input: one Checkbox. */
export function BooleanField({ input, value, onChange }: FieldProps<'boolean', boolean>) {
  return <Checkbox label={input.label} checked={value} onChange={onChange} />
}
