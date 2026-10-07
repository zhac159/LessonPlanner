import type { ReactNode } from 'react'

export interface SelectChipOption {
  value: string
  label: string
  /** Icon or SwatchDot shown before the label (in the menu, and on the chip when selected). */
  leading?: ReactNode
  /** CSS colour (a `var(--…)` token) the chip takes while this option is selected. */
  fill?: string
  disabled?: boolean
}
