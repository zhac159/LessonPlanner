import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cx } from '../internal/cx'
import { useControllable } from '../internal/useControllable'
import './ToggleChip.css'

export interface ToggleChipProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'type' | 'onChange' | 'aria-pressed'
> {
  /** Controlled pressed state. */
  pressed?: boolean
  /** Initial pressed state when uncontrolled. */
  defaultPressed?: boolean
  /** Called with the new pressed state when the chip is clicked. */
  onPressedChange?: (pressed: boolean) => void
}

/** A pill button with `aria-pressed` (design-system: ToggleChip). Off = outlined, on = ink fill. */
export function ToggleChip({
  pressed,
  defaultPressed = false,
  onPressedChange,
  onClick,
  className,
  children,
  ...rest
}: ToggleChipProps): ReactNode {
  const [on, setOn] = useControllable(pressed, defaultPressed, onPressedChange)
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={on}
      className={cx('tc', className)}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) setOn(!on)
      }}
    >
      {children}
    </button>
  )
}
