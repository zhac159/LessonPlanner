import type { AssetLicence } from '@shared/assets/types'
import { cx } from '../../atoms/cx'
import { LicenceBadge } from '../LicenceBadge/LicenceBadge'
import { Thumb } from '../internal/Thumb'
import type { RovingItemProps } from '../internal/useRovingGrid'
import './OnlineResultCard.css'

export interface OnlineResultCardProps {
  title: string
  /** "Wikimedia Commons", "Openverse". */
  providerLabel: string
  licence: Pick<AssetLicence, 'id' | 'label'>
  thumbSrc?: string | null
  /** The one shown in the detail pane: orange offset shadow. */
  selected?: boolean
  /** A9: a checkbox on the picture builds the selection. */
  checkable?: boolean
  checked?: boolean
  onSelect?: () => void
  onCheckedChange?: (checked: boolean) => void
  /** A13: small card, the title and the licence on one row, no source line. */
  compact?: boolean
  itemProps?: RovingItemProps
  className?: string
}

/** One search result: picture, title, source and licence pill; ticked with a checkbox in A9. */
export function OnlineResultCard({
  title,
  providerLabel,
  licence,
  thumbSrc,
  selected = false,
  checkable = false,
  checked = false,
  onSelect,
  onCheckedChange,
  compact = false,
  itemProps,
  className
}: OnlineResultCardProps) {
  return (
    <div
      className={cx('as-result', className)}
      data-selected={selected || checked || undefined}
      data-compact={compact || undefined}
    >
      <button
        type="button"
        className="as-result__main"
        aria-pressed={selected}
        aria-label={`${title}, ${providerLabel}, ${licence.label}`}
        onClick={onSelect}
        {...itemProps}
      >
        <Thumb src={thumbSrc} className="as-result__thumb" />
        <span className="as-result__body">
          <span className="as-result__title">{title}</span>
          <span className="as-result__meta">
            {!compact && <span className="as-result__source">{providerLabel}</span>}
            <LicenceBadge licence={licence} />
          </span>
        </span>
      </button>
      {checkable && (
        <label className="as-result__check">
          <input
            type="checkbox"
            checked={checked}
            tabIndex={-1}
            onChange={(event) => onCheckedChange?.(event.target.checked)}
          />
          <span className="as-sr-only">{`Select ${title}`}</span>
        </label>
      )}
    </div>
  )
}
