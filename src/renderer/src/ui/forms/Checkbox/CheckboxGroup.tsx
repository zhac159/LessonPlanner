import type { ReactNode } from 'react'
import { cx } from '../internal/cx'
import '../internal/forms.css'
import './Checkbox.css'

export interface CheckboxGroupProps {
  /** The group's name, shown above the rows (e.g. "Question types"). */
  legend: string
  hideLegend?: boolean
  /** Disables every checkbox inside. */
  disabled?: boolean
  className?: string
  /** `Checkbox` rows. */
  children: ReactNode
}

/** A `<fieldset>` with a prominent legend that stacks Checkbox rows (6px apart). */
export function CheckboxGroup({
  legend,
  hideLegend,
  disabled,
  className,
  children
}: CheckboxGroupProps): ReactNode {
  return (
    <fieldset className={cx('cb-group', className)} disabled={disabled}>
      <legend className={cx('cb-group__legend', hideLegend && 'fk-sr-only')}>{legend}</legend>
      <div className="cb-group__rows">{children}</div>
    </fieldset>
  )
}
