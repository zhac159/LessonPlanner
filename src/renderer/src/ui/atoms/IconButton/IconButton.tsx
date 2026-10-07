import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cx } from '../cx'
import './IconButton.css'

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** Required accessible name: icon-only buttons have no visible text. */
  'aria-label': string
  /** round / square = outlined 44px; ghost = borderless 36px with a 44px hit area. */
  variant?: 'round' | 'square' | 'ghost'
  /** The icon (an unsized lucide icon: 20px, or 16px for ghost). */
  children: ReactNode
}

/**
 * Icon-only button. Pass `aria-pressed` or `aria-expanded` for toggles; "true" paints it orange.
 */
export function IconButton({
  variant = 'round',
  className,
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx('ui-icon-button', className)}
      data-variant={variant}
    >
      <span className="ui-icon-button__icon" aria-hidden="true">
        {children}
      </span>
    </button>
  )
}
