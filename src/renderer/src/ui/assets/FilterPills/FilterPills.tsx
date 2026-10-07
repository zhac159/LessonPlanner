import { visibleFilters, type AssetFilterId } from '@shared/assets/library'
import { cx } from '../../atoms/cx'
import { ToggleChip } from '../../forms/ToggleChip/ToggleChip'
import './FilterPills.css'

export interface FilterPillsProps {
  /** Items per pill (`filterCounts`); "Symbol cards" only shows when she has some. */
  counts: Record<AssetFilterId, number>
  value: AssetFilterId
  onChange: (id: AssetFilterId) => void
  /** Pills that are left out, e.g. a picker that cannot show banners. */
  hide?: readonly AssetFilterId[]
  /** Show "All · 12" (A1, A8). The picker says just "All". */
  showCount?: boolean
  /** Scroll sideways instead of wrapping (narrow sheets). */
  scroll?: boolean
  /** Names the group; default "Filter by kind". */
  label?: string
  className?: string
}

/** The row of kind filters: All, Logos, Icons, Pictures, Diagrams, Banners, Characters. One is on. */
export function FilterPills({
  counts,
  value,
  onChange,
  hide = [],
  showCount = true,
  scroll = false,
  label = 'Filter by kind',
  className
}: FilterPillsProps) {
  const filters = visibleFilters(counts).filter((f) => !hide.includes(f.id))
  return (
    <div
      className={cx('as-filters', className)}
      role="group"
      aria-label={label}
      data-scroll={scroll || undefined}
    >
      {filters.map((filter) => (
        <ToggleChip
          key={filter.id}
          pressed={filter.id === value}
          onPressedChange={() => onChange(filter.id)}
          // A pressed pill stays pressed: clicking it again keeps the filter.
          onClick={(event) => {
            if (filter.id === value) event.preventDefault()
          }}
        >
          {filter.id === 'all' && showCount ? `All · ${counts.all}` : filter.label}
        </ToggleChip>
      ))}
    </div>
  )
}
