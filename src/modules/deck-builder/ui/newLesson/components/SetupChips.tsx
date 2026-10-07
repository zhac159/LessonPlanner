import { useId } from 'react'
import { SelectChip, type SelectChipOption } from '@ui/forms'
import { yearColor } from '@ui/lesson'
import {
  ABILITIES,
  LENGTHS_MIN,
  SLIDE_COUNTS,
  YEAR_GROUPS,
  type ChipKey,
  type LessonSetup
} from '../setup'

export interface SetupChipsProps {
  setup: LessonSetup
  onChange(key: ChipKey, value: string | number): void
}

/** The fixed choices, plus the current value when it came from a guess outside the list ("55 min"). */
function numberOptions(
  values: ReadonlyArray<number>,
  current: number,
  label: (n: number) => string
): SelectChipOption[] {
  const all = values.includes(current) ? [...values] : [...values, current].sort((a, b) => a - b)
  return all.map((n) => ({ value: String(n), label: label(n) }))
}

/**
 * "Lesson set-up" (05 §5): Year group, length, ability and about how many slides. Each chip is a
 * SelectChip; the year chip takes the year's tint.
 */
export function SetupChips({ setup, onChange }: SetupChipsProps) {
  const labelId = useId()
  return (
    <div className="nl-setup" role="group" aria-labelledby={labelId}>
      <p id={labelId} className="nl-setup__label">
        Lesson set-up
      </p>
      <div className="nl-setup__chips">
        <SelectChip
          size="sm"
          label="Year group"
          placeholder="Year group"
          value={setup.yearGroup ?? undefined}
          options={YEAR_GROUPS.map((g) => ({ value: g, label: g, fill: yearColor(g) }))}
          onChange={(value) => onChange('year', value)}
        />
        <SelectChip
          size="sm"
          label="Lesson length"
          value={String(setup.durationMin)}
          options={numberOptions(LENGTHS_MIN, setup.durationMin, (n) => `${n} min`)}
          onChange={(value) => onChange('length', Number(value))}
        />
        <SelectChip
          size="sm"
          label="Ability"
          value={setup.ability}
          options={ABILITIES.map((a) => ({ value: a, label: a }))}
          onChange={(value) => onChange('ability', value)}
        />
        <SelectChip
          size="sm"
          label="Number of slides"
          value={String(setup.slideCount)}
          options={numberOptions(SLIDE_COUNTS, setup.slideCount, (n) => `About ${n} slides`)}
          onChange={(value) => onChange('slides', Number(value))}
        />
      </div>
    </div>
  )
}
