import { SquareCheckBig } from 'lucide-react'
import type { AssetFilterId } from '@shared/assets/library'
import type { AssetFrom, AssetPage } from '@shared/contracts/assets'
import { Button } from '@ui/atoms'
import { FilterPills } from '@ui/assets'
import { Select } from '@ui/forms'

export interface LibraryToolbarProps {
  counts: AssetPage['counts']
  filter: AssetFilterId
  onFilterChange(filter: AssetFilterId): void
  froms: AssetPage['froms']
  from: AssetFrom
  onFromChange(from: AssetFrom): void
  selecting: boolean
  onSelectingChange(on: boolean): void
}

/** The kind pills, then "Select" (becomes "Done selecting") and the "From" select. */
export function LibraryToolbar({
  counts,
  filter,
  onFilterChange,
  froms,
  from,
  onFromChange,
  selecting,
  onSelectingChange
}: LibraryToolbarProps) {
  return (
    <div className="as-toolbar">
      <FilterPills counts={counts} value={filter} onChange={onFilterChange} />
      <div className="as-toolbar__end">
        <Button
          variant="secondary"
          icon={<SquareCheckBig strokeWidth={2.2} />}
          className="as-toolbar__select"
          aria-pressed={selecting}
          onClick={() => onSelectingChange(!selecting)}
        >
          {selecting ? 'Done selecting' : 'Select'}
        </Button>
        <Select
          label="From"
          labelPosition="inline"
          size="sm"
          value={from}
          options={froms.map((option) => ({ value: option.key, label: option.label }))}
          onChange={(value) => onFromChange(value as AssetFrom)}
        />
      </div>
    </div>
  )
}
