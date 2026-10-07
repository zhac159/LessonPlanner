import type { PluginInput } from '@shared/contracts/deck-builder-plugins'

/** The input of a given `type`, narrowed from the manifest's union. */
export type InputOf<T extends PluginInput['type']> = Extract<PluginInput, { type: T }>

/** What every generated field receives. */
export interface FieldProps<T extends PluginInput['type'], V> {
  input: InputOf<T>
  value: V
  onChange: (value: V) => void
  /** Message to show under the field; undefined when it is valid. */
  error?: string
}
