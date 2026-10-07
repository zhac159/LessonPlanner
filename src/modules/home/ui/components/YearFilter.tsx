import { ToggleChip } from '@ui/forms'
import { ALL_YEARS } from '../model/lessons'

export interface YearFilterProps {
  /** The year groups present in the lessons, in display order. */
  years: ReadonlyArray<string>
  /** The selected group, or `ALL_YEARS`. */
  value: string
  onChange(year: string): void
}

/**
 * Single-select year-group chips: "All" plus one per group. Pressing the pressed chip goes back to
 * All (03 §8), which the kit's ToggleChipGroup does not do.
 */
export function YearFilter({ years, value, onChange }: YearFilterProps) {
  const options = [
    { value: ALL_YEARS, label: 'All' },
    ...years.map((y) => ({ value: y, label: y }))
  ]
  return (
    <div role="group" aria-label="Filter by year group" className="home-years">
      {options.map((option) => (
        <ToggleChip
          key={option.value}
          pressed={value === option.value}
          onPressedChange={(on) => onChange(on ? option.value : ALL_YEARS)}
        >
          {option.label}
        </ToggleChip>
      ))}
    </div>
  )
}
