import { LoaderCircle } from 'lucide-react'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type MouseEvent,
  type ReactNode
} from 'react'
import { cx } from '../cx'
import './Button.css'

export interface ButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** primary = the one main action; dark = commit beside a field; secondary = the rest; ghost = dense rows. */
  variant?: 'primary' | 'dark' | 'secondary' | 'ghost'
  /** Heights 32 / 44 / 48 / 52. `sm` is always a pill. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Pills for chat, composer and back navigation; rectangles elsewhere. */
  shape?: 'rect' | 'pill'
  /** Leading action icon (an unsized lucide icon: the button sizes it). */
  icon?: ReactNode
  /** Trailing icon for going forward (`ArrowRight`). */
  iconAfter?: ReactNode
  /** Shows a spinner and `loadingLabel`, locks the width and ignores clicks. */
  loading?: boolean
  /** Progress wording while loading, e.g. "Making quiz…". Falls back to the normal label. */
  loadingLabel?: string
  children: ReactNode
}

/** The app's button. Use `aria-disabled="true"` instead of `disabled` to stay focusable. */
export function Button({
  variant = 'secondary',
  size = 'md',
  shape = 'rect',
  icon,
  iconAfter,
  loading = false,
  loadingLabel,
  children,
  className,
  type = 'button',
  onClick,
  ref,
  ...rest
}: ButtonProps) {
  const node = useRef<HTMLButtonElement | null>(null)
  const restWidth = useRef(0)

  const setRef = useCallback(
    (el: HTMLButtonElement | null) => {
      node.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref]
  )

  // Remember the resting width so the label change while loading cannot make the button jump.
  useLayoutEffect(() => {
    if (!loading && node.current) restWidth.current = node.current.offsetWidth
  })
  useLayoutEffect(() => {
    const el = node.current
    if (el) el.style.minWidth = loading && restWidth.current ? `${restWidth.current}px` : ''
  }, [loading])

  const blocked = loading || rest['aria-disabled'] === true || rest['aria-disabled'] === 'true'
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (blocked) event.preventDefault()
    else onClick?.(event)
  }

  return (
    <button
      {...rest}
      ref={setRef}
      type={type}
      className={cx('ui-button', className)}
      data-variant={variant}
      data-size={size}
      data-shape={size === 'sm' ? 'pill' : shape}
      aria-busy={loading || undefined}
      onClick={handleClick}
    >
      {loading ? (
        <LoaderCircle className="ui-button__spinner" aria-hidden="true" />
      ) : (
        icon && (
          <span className="ui-button__icon" aria-hidden="true">
            {icon}
          </span>
        )
      )}
      <span className="ui-button__label">{loading && loadingLabel ? loadingLabel : children}</span>
      {!loading && iconAfter && (
        <span className="ui-button__icon" aria-hidden="true">
          {iconAfter}
        </span>
      )}
    </button>
  )
}
