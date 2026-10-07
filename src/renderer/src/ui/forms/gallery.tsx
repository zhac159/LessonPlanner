import type { ReactNode } from 'react'
import {
  ChoiceStates,
  NumberStepperStates,
  SelectChipStates,
  ToggleChipStates
} from './demos/choices'
import { SelectStates, TextAreaStates, TextFieldStates } from './demos/fields'

export interface GallerySection {
  name: string
  render: () => ReactNode
}

/** Every forms-kit component in every state, for the component gallery and visual checks. */
const gallery: { title: string; sections: GallerySection[] } = {
  title: 'Forms',
  sections: [
    { name: 'TextField', render: () => <TextFieldStates /> },
    { name: 'TextArea', render: () => <TextAreaStates /> },
    { name: 'Select', render: () => <SelectStates /> },
    { name: 'ToggleChip', render: () => <ToggleChipStates /> },
    { name: 'SelectChip', render: () => <SelectChipStates /> },
    { name: 'Checkbox and radios', render: () => <ChoiceStates /> },
    { name: 'NumberStepper', render: () => <NumberStepperStates /> }
  ]
}

export default gallery
