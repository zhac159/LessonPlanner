import { RadioCardGroup } from '../../../forms/RadioCard/RadioCard'
import { RadioPillGroup } from '../../../forms/RadioPill/RadioPill'
import { Select } from '../../../forms/Select/Select'
import type { SlideRangeOption } from '../values'
import type { FieldProps } from './types'

/** Longest option list that still reads well as a row of pills. */
export const MAX_PILLS = 4

/**
 * A `choice` input (plugin-architecture.md §4): RadioCards when any option has a description,
 * RadioPills for up to four short options, a Select for more.
 */
export function ChoiceField({ input, value, onChange }: FieldProps<'choice', string>) {
  const described = input.options.some((option) => option.description)
  if (described) {
    return (
      <RadioCardGroup
        legend={input.label}
        options={input.options}
        value={value}
        onChange={onChange}
      />
    )
  }
  if (input.options.length <= MAX_PILLS) {
    return (
      <RadioPillGroup
        legend={input.label}
        options={input.options}
        value={value}
        onChange={onChange}
      />
    )
  }
  return <Select label={input.label} options={input.options} value={value} onChange={onChange} />
}

/** The `slideRange` input: pills computed from the editor's selection. */
export function SlideRangeField({
  input,
  value,
  onChange,
  options
}: FieldProps<'slideRange', string> & { options: SlideRangeOption[] }) {
  return <RadioPillGroup legend={input.label} options={options} value={value} onChange={onChange} />
}
