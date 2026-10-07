import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../../atoms/cx'
import type { RovingItemProps } from '../internal/useRovingGrid'
import { Thumb } from '../internal/Thumb'
import './AssetTile.css'

export interface AssetTileProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** The chat name (mono, cut with an ellipsis; the full name is the accessible name and the hover title). */
  name: string
  thumbSrc?: string | null
  /** The orange ring. Also `aria-pressed`. */
  selected?: boolean
  /** Roving-grid props from `AssetGrid`. */
  itemProps?: RovingItemProps
}

/** A square tile: the picture on a lavender tint and the name under it. Used in pickers and sheets. */
export function AssetTile({
  name,
  thumbSrc,
  selected = false,
  itemProps,
  className,
  type = 'button',
  ...rest
}: AssetTileProps) {
  return (
    <button
      title={name}
      {...rest}
      {...itemProps}
      type={type}
      aria-pressed={selected}
      className={cx('as-tile', className)}
      data-selected={selected || undefined}
    >
      <Thumb src={thumbSrc} className="as-tile__thumb" />
      <span className="as-tile__name as-mono">{name}</span>
    </button>
  )
}
