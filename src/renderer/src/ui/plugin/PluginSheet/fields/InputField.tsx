import type { PluginInput } from '@shared/contracts/deck-builder-plugins'
import type { SlideRangeOption } from '../values'
import { ChoiceField, SlideRangeField } from './ChoiceFields'
import { MultiField } from './MultiField'
import { NumberField } from './NumberField'
import { BooleanField, TextInputField } from './TextAndBooleanFields'

export interface InputFieldProps {
  input: PluginInput
  /** The current value; its type follows the input's type. */
  value: unknown
  onChange: (value: unknown) => void
  error?: string
  /** The computed options of a `slideRange` input. */
  slideOptions: SlideRangeOption[]
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Renders one manifest input with the control the plugin architecture assigns to its type. */
export function InputField({ input, value, onChange, error, slideOptions }: InputFieldProps) {
  switch (input.type) {
    case 'slideRange':
      return (
        <SlideRangeField
          input={input}
          value={asString(value)}
          onChange={onChange}
          options={slideOptions}
        />
      )
    case 'choice':
      return <ChoiceField input={input} value={asString(value)} onChange={onChange} />
    case 'multi':
      return (
        <MultiField
          input={input}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          error={error}
        />
      )
    case 'number':
      return (
        <NumberField
          input={input}
          value={typeof value === 'number' ? value : input.default}
          onChange={onChange}
        />
      )
    case 'text':
      return (
        <TextInputField input={input} value={asString(value)} onChange={onChange} error={error} />
      )
    case 'boolean':
      return <BooleanField input={input} value={value === true} onChange={onChange} />
  }
}
