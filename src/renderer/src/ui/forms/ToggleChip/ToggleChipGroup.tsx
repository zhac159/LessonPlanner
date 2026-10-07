import type { ReactNode } from 'react'
import { cx } from '../internal/cx'
import { useControllable } from '../internal/useControllable'
import { ToggleChip } from './ToggleChip'

export interface ToggleChipOption {
  value: string
  label: string
  disabled?: boolean
}

export interface ToggleChipGroupProps {
  /** Names the group, e.g. "Filter by year group". */
  label: string
  options: ToggleChipOption[]
  /** Controlled selected value. */
  value?: string
  /** Initial value when uncontrolled (default: the first option). */
  defaultValue?: string
  onChange?: (value: string) => void
  className?: string
}

/**
 * A single-select filter built from ToggleChips. Choosing a chip switches the others off, so an
 * "All" option works as "clear the filter". Clicking the chip that is already on does nothing.
 */
export function ToggleChipGroup({
  label,
  options,
  value,
  defaultValue,
  onChange,
  className
}: ToggleChipGroupProps): ReactNode {
  const [current, setCurrent] = useControllable(
    value,
    defaultValue ?? options[0]?.value ?? '',
    onChange
  )
  return (
    <div role="group" aria-label={label} className={cx('tc-group', className)}>
      {options.map((option) => (
        <ToggleChip
          key={option.value}
          pressed={current === option.value}
          disabled={option.disabled}
          onPressedChange={(on) => on && setCurrent(option.value)}
        >
          {option.label}
        </ToggleChip>
      ))}
    </div>
  )
}
