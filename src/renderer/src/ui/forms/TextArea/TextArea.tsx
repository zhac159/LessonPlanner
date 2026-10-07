import {
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type InputEvent,
  type ReactNode
} from 'react'
import { cx } from '../internal/cx'
import { FieldShell } from '../internal/FieldShell'
import { mergeRefs } from '../internal/mergeRefs'
import { describedBy, useFieldIds } from '../internal/useFieldIds'
import './TextArea.css'

export interface TextAreaProps extends Omit<ComponentPropsWithRef<'textarea'>, 'rows'> {
  /** Accessible name; shown above the field unless `hideLabel`. */
  label: string
  hideLabel?: boolean
  strongLabel?: boolean
  hint?: string
  /** Error message. Sets `aria-invalid`. */
  error?: string
  invalid?: boolean
  /** Minimum number of visible rows (default 4). */
  rows?: number
  /** Grow with the content instead of scrolling (turns off manual resize). */
  autoGrow?: boolean
}

/** Multi-line text input (design-system: TextArea). */
export function TextArea({
  label,
  hideLabel,
  strongLabel,
  hint,
  error,
  invalid,
  rows = 4,
  autoGrow,
  id,
  className,
  disabled,
  value,
  onInput,
  ref,
  'aria-describedby': describedByProp,
  ...rest
}: TextAreaProps): ReactNode {
  const ids = useFieldIds(id)
  const innerRef = useRef<HTMLTextAreaElement>(null)
  const isInvalid = Boolean(error) || Boolean(invalid)

  const fit = (): void => {
    const el = innerRef.current
    if (!autoGrow || !el) return
    el.style.height = 'auto'
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`
  }
  useLayoutEffect(fit, [autoGrow, value]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleInput = (event: InputEvent<HTMLTextAreaElement>): void => {
    fit()
    onInput?.(event)
  }

  return (
    <FieldShell
      ids={ids}
      label={label}
      hideLabel={hideLabel}
      strongLabel={strongLabel}
      hint={hint}
      error={error}
      className={className}
    >
      <textarea
        {...rest}
        ref={mergeRefs(innerRef, ref)}
        id={ids.id}
        value={value}
        rows={rows}
        disabled={disabled}
        onInput={handleInput}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy(ids, { hint, error }, describedByProp)}
        className={cx(
          'fk-field ta',
          autoGrow && 'ta--auto',
          isInvalid && 'is-invalid',
          disabled && 'is-disabled'
        )}
      />
    </FieldShell>
  )
}
