import { Image as ImageIcon } from 'lucide-react'
import type { ComponentPropsWithRef } from 'react'

export const ADD_ASSET_NAME = 'Add asset'
export const ADD_ASSET_LINE = 'A logo, icon or picture from your library'

export interface AddAssetTileProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'children' | 'disabled' | 'role'
> {
  /** The dark "New" pill (until the tile has been used three times). */
  showNew: boolean
  disabled?: boolean
}

/** The built-in "Add asset" tile of the "+" menu: full width, mint, above the plugins (agents/ASSETS.md §3.3). */
export function AddAssetTile({
  showNew,
  disabled = false,
  type = 'button',
  onClick,
  ...rest
}: AddAssetTileProps) {
  return (
    <button
      {...rest}
      type={type}
      role="menuitem"
      className="plugin-tile plugin-tile--asset"
      data-tone="mint"
      aria-disabled={disabled || undefined}
      aria-description={ADD_ASSET_LINE}
      onClick={(event) => {
        if (disabled) event.preventDefault()
        else onClick?.(event)
      }}
    >
      <span className="plugin-tile__icon" aria-hidden="true">
        <ImageIcon size={22} strokeWidth={2} />
      </span>
      <span className="plugin-tile__text">
        <span className="plugin-tile__name">{ADD_ASSET_NAME}</span>
        <span className="plugin-tile__desc">{ADD_ASSET_LINE}</span>
      </span>
      {showNew && <span className="plugin-tile__new">New</span>}
    </button>
  )
}
