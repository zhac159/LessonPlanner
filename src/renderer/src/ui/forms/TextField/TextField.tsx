import { LoaderCircle, Pencil, Search } from 'lucide-react'
import { useState, type ComponentPropsWithRef, type ReactNode } from 'react'
import { cx } from '../internal/cx'
import { FieldShell } from '../internal/FieldShell'
import { describedBy, useFieldIds } from '../internal/useFieldIds'
import './TextField.css'

export type TextFieldSize = 'xl' | 'lg' | 'md'
export type TextFieldVariant = 'default' | 'search' | 'password' | 'title'

export interface TextFieldProps extends Omit<
  ComponentPropsWithRef<'input'>,
  'size' | 'prefix' | 'type'
> {
  /** Accessible name; shown above the field unless `hideLabel` (search and title always hide it). */
  label: string
  hideLabel?: boolean
  /** Use the prominent 15/800 label for a single important field. */
  strongLabel?: boolean
  /** Help text below the field; replaced by `error` while there is one. */
  hint?: string
  /** Error message. Sets `aria-invalid`. */
  error?: string
  /** Invalid without a message (the message lives elsewhere). */
  invalid?: boolean
  size?: TextFieldSize
  /** `search` = pill with a leading magnifier, `password` = masked + Show/Hide, `title` = dashed lesson title. */
  variant?: TextFieldVariant
  /** Content inside the field before the text. */
  prefix?: ReactNode
  /** Content inside the field after the text. */
  suffix?: ReactNode
  /** Async validation in progress: shows a spinner and sets `aria-busy`. */
  loading?: boolean
  /** 600-weight value, for short identity values (a name, a style name). */
  strongValue?: boolean
  type?: 'text' | 'email' | 'url' | 'tel'
}

/** Single-line text input with label, help and error text (design-system: TextField). */
export function TextField({
  label,
  hideLabel,
  strongLabel,
  hint,
  error,
  invalid,
  size,
  variant = 'default',
  prefix,
  suffix,
  loading,
  strongValue,
  type = 'text',
  id,
  className,
  disabled,
  'aria-describedby': describedByProp,
  ...inputProps
}: TextFieldProps): ReactNode {
  const ids = useFieldIds(id)
  const [revealed, setRevealed] = useState(false)
  const isSearch = variant === 'search'
  const isPassword = variant === 'password'
  const isTitle = variant === 'title'
  const resolvedSize = size ?? (isSearch ? 'md' : 'lg')
  const isInvalid = Boolean(error) || Boolean(invalid)
  const masked = isPassword && !revealed

  const lead = prefix ?? (isSearch ? <Search size={18} aria-hidden="true" /> : null)
  const trail = loading ? (
    <LoaderCircle size={16} className="fk-spin" aria-hidden="true" />
  ) : (
    (suffix ?? (isTitle ? <Pencil size={16} aria-hidden="true" /> : null))
  )

  return (
    <FieldShell
      ids={ids}
      label={label}
      hideLabel={hideLabel || isSearch || isTitle}
      strongLabel={strongLabel}
      hint={hint}
      error={error}
      className={cx('tf-shell', isTitle && 'tf-shell--title', className)}
    >
      <div className="tf-row">
        <div
          className={cx(
            'fk-field tf-box',
            `tf-box--${resolvedSize}`,
            `tf-box--${variant}`,
            isInvalid && 'is-invalid',
            disabled && 'is-disabled'
          )}
        >
          {lead ? <span className="tf-adorn">{lead}</span> : null}
          <input
            {...inputProps}
            id={ids.id}
            type={isSearch ? 'search' : masked ? 'password' : type}
            disabled={disabled}
            aria-invalid={isInvalid || undefined}
            aria-busy={loading || undefined}
            aria-describedby={describedBy(ids, { hint, error }, describedByProp)}
            className={cx(
              'fk-input tf-input',
              strongValue && 'tf-input--strong',
              masked && 'tf-input--masked'
            )}
          />
          {trail ? <span className="tf-adorn">{trail}</span> : null}
        </div>
        {isPassword ? (
          <button
            type="button"
            className="tf-reveal"
            aria-pressed={revealed}
            aria-controls={ids.id}
            disabled={disabled}
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        ) : null}
      </div>
    </FieldShell>
  )
}
