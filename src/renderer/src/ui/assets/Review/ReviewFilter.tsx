import { cx } from '../../atoms/cx'
import '../FilterPills/FilterPills.css'
import { ToggleChip } from '../../forms/ToggleChip/ToggleChip'

export type ReviewView = 'all' | 'keeping' | 'left-out'

const VIEWS: ReadonlyArray<{ id: ReviewView; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'keeping', label: 'Keeping' },
  { id: 'left-out', label: 'Left out' }
]

export interface ReviewFilterProps {
  value: ReviewView
  onChange: (value: ReviewView) => void
  className?: string
}

/** The header pills of A2: All, Keeping, Left out. One is always on. */
export function ReviewFilter({ value, onChange, className }: ReviewFilterProps) {
  return (
    <div className={cx('as-filters', className)} role="group" aria-label="Show">
      {VIEWS.map((view) => (
        <ToggleChip
          key={view.id}
          pressed={view.id === value}
          onPressedChange={() => onChange(view.id)}
          onClick={(event) => {
            if (view.id === value) event.preventDefault()
          }}
        >
          {view.label}
        </ToggleChip>
      ))}
    </div>
  )
}
