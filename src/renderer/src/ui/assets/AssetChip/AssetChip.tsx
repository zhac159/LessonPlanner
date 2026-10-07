import { X } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { ASSET_KIND_LABELS, type AssetKind } from '@shared/assets/types'
import { cx } from '../../atoms/cx'
import { Thumb } from '../internal/Thumb'
import './AssetChip.css'

export interface AssetChipProps {
  /** The chat name, shown in the mono face: `school_logo`. */
  name: string
  /** "School logo": shown in the popover. */
  title?: string
  kind?: AssetKind | null
  /** The 20 px round picture (data URL). */
  thumbSrc?: string | null
  /** inline = in text, composer = removable, removed = greyed, its asset was deleted. */
  variant?: 'inline' | 'composer' | 'removed'
  /** Composer: Backspace on the chip or its × calls this. */
  onRemove?: () => void
  className?: string
}

/** A pill with the asset's picture and chat name. Hover or focus shows a popover with the picture, title and kind. */
export function AssetChip({
  name,
  title,
  kind,
  thumbSrc,
  variant = 'inline',
  onRemove,
  className
}: AssetChipProps) {
  const popoverId = useId()
  const [open, setOpen] = useState(false)
  const removed = variant === 'removed'
  const removable = variant === 'composer' && onRemove

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>): void => {
    if (event.key === 'Escape' && open) {
      setOpen(false)
      event.stopPropagation()
    } else if (removable && (event.key === 'Backspace' || event.key === 'Delete')) {
      event.preventDefault()
      onRemove()
    }
  }

  return (
    <span
      className={cx('as-chip', className)}
      data-variant={variant}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <span
        className="as-chip__main"
        tabIndex={0}
        role="group"
        aria-label={removed ? `${name}, removed` : name}
        aria-describedby={open && !removed ? popoverId : undefined}
        onKeyDown={onKeyDown}
      >
        <Thumb src={thumbSrc} className="as-chip__thumb" />
        <span className="as-chip__name as-mono">{name}</span>
        {removed && <span className="as-chip__removed">removed</span>}
      </span>
      {removable && (
        <button
          type="button"
          className="as-chip__x"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
        >
          <X size={12} strokeWidth={2.6} aria-hidden="true" />
        </button>
      )}
      {open && !removed && (
        <span role="tooltip" id={popoverId} className="as-chip__popover">
          <Thumb src={thumbSrc} className="as-chip__preview" />
          <span className="as-chip__title">{title ?? name}</span>
          {kind && <span className="as-chip__kind">{ASSET_KIND_LABELS[kind]}</span>}
        </span>
      )}
    </span>
  )
}
