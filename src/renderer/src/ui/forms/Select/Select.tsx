import { ChevronDown } from 'lucide-react'
import type { ChangeEvent, ComponentPropsWithRef, ReactNode } from 'react'
import { cx } from '../internal/cx'
import { FieldShell } from '../internal/FieldShell'
import { describedBy, useFieldIds } from '../internal/useFieldIds'
import './Select.css'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<
  ComponentPropsWithRef<'select'>,
  'size' | 'onChange' | 'children'
> {
  /** Accessible name. */
  label: string
  hideLabel?: boolean
  /** `above` (default, prominent label) or `inline` to the left ("Sort"). */
  labelPosition?: 'above' | 'inline'
  hint?: string
  error?: string
  invalid?: boolean
  /** `lg` = 48 high (forms), `sm` = 40 high. Set `--fk-radius` on `className` to change the corner radius. */
  size?: 'lg' | 'sm'
  options: SelectOption[]
  /** Shown (and not selectable) while no value is chosen. */
  placeholder?: string
  /** Called with the chosen option's value. */
  onChange?: (value: string, event: ChangeEvent<HTMLSelectElement>) => void
}

/** Styled native `<select>` (design-system: Select). The option list is the OS popup. */
export function Select({
  label,
  hideLabel,
  labelPosition = 'above',
  hint,
  error,
  invalid,
  size = 'lg',
  options,
  placeholder,
  onChange,
  id,
  className,
  disabled,
  value,
  defaultValue,
  'aria-describedby': describedByProp,
  ...rest
}: SelectProps): ReactNode {
  const ids = useFieldIds(id)
  const isInvalid = Boolean(error) || Boolean(invalid)
  const uncontrolledDefault =
    value === undefined ? (defaultValue ?? (placeholder ? '' : undefined)) : undefined

  return (
    <FieldShell
      ids={ids}
      label={label}
      hideLabel={hideLabel}
      strongLabel={labelPosition === 'above'}
      labelPosition={labelPosition}
      hint={hint}
      error={error}
      className={className}
    >
      <div className={cx('sel', `sel--${size}`)}>
        <select
          {...rest}
          id={ids.id}
          value={value}
          defaultValue={uncontrolledDefault}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value, event)}
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedBy(ids, { hint, error }, describedByProp)}
          className={cx('fk-field sel__control', isInvalid && 'is-invalid')}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} strokeWidth={2.2} className="sel__chevron" aria-hidden="true" />
      </div>
    </FieldShell>
  )
}
