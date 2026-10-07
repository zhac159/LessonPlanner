import { useEffect, useRef, type ComponentPropsWithRef, type ReactNode } from 'react'
import { cx } from '../internal/cx'
import { mergeRefs } from '../internal/mergeRefs'
import './Checkbox.css'

export interface CheckboxProps extends Omit<
  ComponentPropsWithRef<'input'>,
  'type' | 'onChange' | 'size'
> {
  /** The row's text; it is the accessible name. */
  label: ReactNode
  /** Controlled checked state (use with `onChange`). */
  checked?: boolean
  defaultChecked?: boolean
  /** Shows the "mixed" state (a dash) until the user toggles it. */
  indeterminate?: boolean
  /** Called with the new checked state. */
  onChange?: (checked: boolean) => void
  /** The taller 48px, 600-weight row used beside a field ("Make this my default style"). */
  emphasis?: boolean
}

/** Native checkbox in a 44px row (design-system: Checkbox). */
export function Checkbox({
  label,
  indeterminate = false,
  onChange,
  emphasis,
  className,
  ref,
  ...rest
}: CheckboxProps): ReactNode {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate, rest.checked])

  return (
    <label className={cx('cb', emphasis && 'cb--emphasis', className)}>
      <input
        {...rest}
        ref={mergeRefs(inputRef, ref)}
        type="checkbox"
        className="cb__box"
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span className="cb__text">{label}</span>
    </label>
  )
}
