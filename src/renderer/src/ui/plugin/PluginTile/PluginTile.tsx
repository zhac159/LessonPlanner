import type { ComponentPropsWithRef } from 'react'
import type { PluginTint } from '@shared/contracts/deck-builder-plugins'
import { cx } from '../../atoms/cx'
import { Tooltip } from '../../atoms/Tooltip/Tooltip'
import { pluginIcon } from '../icons'
import './PluginTile.css'

export interface PluginTileProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'children' | 'disabled' | 'role'
> {
  name: string
  /** Lucide icon name from the manifest ("list-checks"). */
  icon: string
  /** Pastel fill, or `more` for the dashed white "More plugins" tile. */
  tone: PluginTint | 'more'
  /** One line under 45 characters: the tooltip, `aria-description`, and the list-mode subtitle. */
  description?: string
  /** Show the description under the name (list mode) instead of only as a tooltip. */
  showDescription?: boolean
  /** Not available now. The tile stays focusable and explains why in its tooltip. */
  disabled?: boolean
  /** Why it is disabled, e.g. "Circle something first". */
  disabledReason?: string
}

/** One plugin in the "+" menu (design-system: PluginTile): icon above the name, in the plugin's tone. */
export function PluginTile({
  name,
  icon,
  tone,
  description,
  showDescription = false,
  disabled = false,
  disabledReason,
  className,
  type = 'button',
  onClick,
  ...rest
}: PluginTileProps) {
  const Icon = pluginIcon(icon)
  const tip = disabled ? (disabledReason ?? description) : description
  const tile = (
    <button
      {...rest}
      type={type}
      role="menuitem"
      className={cx('plugin-tile', className)}
      data-tone={tone}
      aria-disabled={disabled || undefined}
      aria-description={description}
      onClick={(event) => {
        if (disabled) event.preventDefault()
        else onClick?.(event)
      }}
    >
      <Icon size={22} strokeWidth={2} aria-hidden="true" />
      <span className="plugin-tile__name">{name}</span>
      {showDescription && description && <span className="plugin-tile__desc">{description}</span>}
    </button>
  )
  return tip ? <Tooltip label={tip}>{tile}</Tooltip> : tile
}
