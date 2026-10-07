import type { ComponentPropsWithRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cx } from '../../atoms/cx'
import { Tooltip } from '../../atoms/Tooltip/Tooltip'
import './ToolButton.css'

export interface ToolButtonProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'children' | 'aria-label' | 'aria-pressed' | 'disabled'
> {
  /** Accessible name ("Circle to edit"). */
  label: string
  /** Tooltip text, usually the label plus its shortcut: "Circle to edit (C)". */
  tooltip?: string
  icon: LucideIcon
  /** A tool: true when it is the active one. Leave undefined for one-shot actions (Undo). */
  pressed?: boolean
  /** Nothing to do (Undo with an empty history). The button stays focusable for the rail's arrows. */
  disabled?: boolean
}

/** One 48px square button of the ToolRail: orange and inked while it is the active tool. */
export function ToolButton({
  label,
  tooltip,
  icon: Icon,
  pressed,
  disabled = false,
  className,
  type = 'button',
  onClick,
  ...rest
}: ToolButtonProps) {
  return (
    <Tooltip label={tooltip ?? label} placement="right">
      <button
        {...rest}
        type={type}
        className={cx('tool-button', className)}
        aria-label={label}
        aria-pressed={pressed}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (disabled) event.preventDefault()
          else onClick?.(event)
        }}
      >
        <Icon size={22} strokeWidth={2} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
