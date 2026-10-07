import { Check } from 'lucide-react'
import type { OnlineKindFilter } from '@shared/contracts/assets'
import { cx } from '../../atoms/cx'
import { RadioPillGroup } from '../../forms/RadioPill/RadioPill'
import { ToggleChip } from '../../forms/ToggleChip/ToggleChip'
import './OnlineSearch.css'

export const ONLINE_KIND_OPTIONS: ReadonlyArray<{ value: OnlineKindFilter; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'photo', label: 'Photos' },
  { value: 'drawing', label: 'Drawings' },
  { value: 'diagram', label: 'Diagrams' }
]

export interface OnlineFiltersProps {
  freeToUse: boolean
  onFreeToUseChange: (on: boolean) => void
  kind: OnlineKindFilter
  onKindChange: (kind: OnlineKindFilter) => void
  /** Results found: "48 results from free image libraries". Leave out before the first search. */
  total?: number | null
  /** A13 only has the "Free to use" chip: the spot's kind is already known. */
  hideKind?: boolean
  className?: string
}

/** The row under the search field: "Free to use in lessons", Any / Photos / Drawings / Diagrams and the count. */
export function OnlineFilters({
  freeToUse,
  onFreeToUseChange,
  kind,
  onKindChange,
  total,
  hideKind = false,
  className
}: OnlineFiltersProps) {
  return (
    <div className={cx('as-online-filters', className)}>
      <ToggleChip
        className="as-online-filters__free"
        pressed={freeToUse}
        onPressedChange={onFreeToUseChange}
      >
        {freeToUse && <Check size={16} strokeWidth={3} aria-hidden="true" />}
        Free to use in lessons
      </ToggleChip>
      {!hideKind && (
        <>
          <span className="as-online-filters__rule" aria-hidden="true" />
          <RadioPillGroup
            legend="Kind of picture"
            hideLegend
            options={ONLINE_KIND_OPTIONS.map((option) => ({ ...option }))}
            value={kind}
            onChange={(value) => onKindChange(value as OnlineKindFilter)}
          />
        </>
      )}
      {typeof total === 'number' && (
        <p className="as-online-filters__total" role="status">
          {`${total} ${total === 1 ? 'result' : 'results'} from free image libraries`}
        </p>
      )}
    </div>
  )
}
