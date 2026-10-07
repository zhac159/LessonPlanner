import { ASSET_KIND_LABELS, type AssetKind } from '@shared/assets/types'
import { lessonCountLabel } from '@shared/assets/library'
import { cx } from '../../atoms/cx'
import type { RovingItemProps } from '../internal/useRovingGrid'
import { Thumb } from '../internal/Thumb'
import './AssetCard.css'

export interface AssetCardProps {
  /** "School logo". */
  title: string
  /** The chat name: `school_logo`. */
  name: string
  kind: AssetKind
  /** Lessons that use it: "14 lessons". Omit to hide the count (A8 shows it too). */
  usedInCount?: number
  thumbSrc?: string | null
  /** The detail pane shows this card: orange offset shadow. */
  selected?: boolean
  /** Selection mode (A8): a checkbox at the top-left and a click ticks the card. */
  selectable?: boolean
  checked?: boolean
  /** Click or Enter when not selectable. */
  onSelect?: () => void
  /** Selection mode: click, Space or the checkbox. */
  onCheckedChange?: (checked: boolean) => void
  itemProps?: RovingItemProps
  className?: string
}

/** The A1 / A8 grid card: a 120 px picture area, the title, the name pill, the kind and the lesson count. */
export function AssetCard({
  title,
  name,
  kind,
  usedInCount,
  thumbSrc,
  selected = false,
  selectable = false,
  checked = false,
  onSelect,
  onCheckedChange,
  itemProps,
  className
}: AssetCardProps) {
  const on = selectable ? checked : selected
  const press = (): void => {
    if (selectable) onCheckedChange?.(!checked)
    else onSelect?.()
  }
  return (
    <div
      className={cx('as-card', className)}
      data-selected={on || undefined}
      data-selectable={selectable || undefined}
    >
      <button
        type="button"
        className="as-card__main"
        aria-pressed={on}
        onClick={press}
        {...itemProps}
      >
        <Thumb src={thumbSrc} className="as-card__thumb" />
        <span className="as-card__body">
          <span className="as-card__title">{title}</span>
          <span className="as-card__name as-mono">{name}</span>
          <span className="as-card__meta">
            <span>{ASSET_KIND_LABELS[kind]}</span>
            {usedInCount !== undefined && <span>{lessonCountLabel(usedInCount)}</span>}
          </span>
        </span>
      </button>
      {selectable && (
        <label className="as-card__check">
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
