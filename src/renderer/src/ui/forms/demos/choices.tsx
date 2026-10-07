import { Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Checkbox } from '../Checkbox/Checkbox'
import { CheckboxGroup } from '../Checkbox/CheckboxGroup'
import { NumberStepper } from '../NumberStepper/NumberStepper'
import { RadioCardGroup } from '../RadioCard/RadioCard'
import { RadioPillGroup } from '../RadioPill/RadioPill'
import { SelectChip } from '../SelectChip/SelectChip'
import { ToggleChipGroup } from '../ToggleChip/ToggleChipGroup'
import { ToggleChip } from '../ToggleChip/ToggleChip'

const row = { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' } as const
const stack = { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 520 } as const

const YEARS = ['All', 'Year 7', 'Year 8', 'Year 9', 'Form time'].map((label) => ({
  value: label.toLowerCase(),
  label
}))
const CHIP_OPTIONS = [
  { value: 'y7', label: 'Year 7', fill: 'var(--year-7)' },
  { value: 'y8', label: 'Year 8', fill: 'var(--year-8)' },
  { value: 'y9', label: 'Year 9', fill: 'var(--year-9)' },
  { value: 'old', label: 'Retired', disabled: true }
]
const LENGTHS = ['30 min', '50 min', '60 min'].map((label) => ({ value: label, label }))

/** ToggleChip: off, on, disabled and the single-select group. */
export function ToggleChipStates(): ReactNode {
  return (
    <div style={stack}>
      <div style={row}>
        <ToggleChip>Off</ToggleChip>
        <ToggleChip defaultPressed>On</ToggleChip>
        <ToggleChip disabled>Disabled</ToggleChip>
      </div>
      <ToggleChipGroup label="Filter by year group" options={YEARS} />
    </div>
  )
}

/** SelectChip: category fill, leading icon, small size, disabled. */
export function SelectChipStates(): ReactNode {
  return (
    <div style={row}>
      <SelectChip label="Year" options={CHIP_OPTIONS} defaultValue="y8" />
      <SelectChip
        label="Lesson length"
        options={LENGTHS}
        defaultValue="50 min"
        leading={<Timer size={16} aria-hidden="true" />}
      />
      <SelectChip label="Year" options={CHIP_OPTIONS} defaultValue="y7" size="sm" />
      <SelectChip label="Style" options={CHIP_OPTIONS} placeholder="Choose a style" />
      <SelectChip label="Year" options={CHIP_OPTIONS} defaultValue="y9" disabled />
    </div>
  )
}

/** Checkbox, CheckboxGroup, RadioPillGroup, RadioCardGroup: checked, unchecked, disabled. */
export function ChoiceStates(): ReactNode {
  return (
    <div style={stack}>
      <Checkbox label="Make this my default style" emphasis defaultChecked />
      <CheckboxGroup legend="Question types">
        <Checkbox label="Multiple choice" defaultChecked />
        <Checkbox label="Short answer" />
        <Checkbox label="Mixed (indeterminate)" indeterminate />
        <Checkbox label="Disabled" disabled />
      </CheckboxGroup>
      <RadioPillGroup
        legend="Which slides?"
        defaultValue="all"
        options={[
          { value: 'all', label: 'All slides' },
          { value: 'current', label: 'This slide' },
          { value: 'selected', label: 'Selected slides', disabled: true }
        ]}
      />
      <RadioCardGroup
        legend="Where should it go?"
        defaultValue="new"
        options={[
          { value: 'new', label: 'A new slide', description: 'Added after the current slide' },
          { value: 'notes', label: 'Speaker notes', description: 'Attached to this slide' },
          {
            value: 'replace',
            label: 'Replace this slide',
            description: 'Not available',
            disabled: true
          }
        ]}
      />
    </div>
  )
}

/** NumberStepper: default, at the minimum, disabled. */
export function NumberStepperStates(): ReactNode {
  const props = {
    min: 3,
    max: 30,
    decrementLabel: 'Fewer questions',
    incrementLabel: 'More questions'
  }
  return (
    <div style={{ ...stack, maxWidth: 420 }}>
      <NumberStepper label="How many questions?" defaultValue={10} {...props} />
      <NumberStepper label="At the minimum" defaultValue={3} {...props} />
      <NumberStepper label="Disabled" defaultValue={10} disabled {...props} />
    </div>
  )
}
