import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cx } from '../internal/cx'
import { ChoiceGroup, type ChoiceGroupProps } from '../internal/ChoiceGroup'
import './RadioPill.css'

export interface RadioPillProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  /** The pill's text; it is the accessible name. */
  label: ReactNode
}

/** A pill-shaped native radio (design-system: RadioPill). Use inside `RadioPillGroup`. */
export function RadioPill({ label, className, ...input }: RadioPillProps): ReactNode {
  return (
    <label className={cx('rp', className)}>
      <input {...input} type="radio" className="rp__radio" />
      <span>{label}</span>
    </label>
  )
}

export type RadioPillGroupProps = Omit<ChoiceGroupProps, 'renderOption' | 'listClassName'>

/**
 * A wrapping row of RadioPills in a fieldset. Arrow keys move and select natively.
 * `onChange` receives the chosen option's value.
 */
export function RadioPillGroup(props: RadioPillGroupProps): ReactNode {
  return (
    <ChoiceGroup
      {...props}
      listClassName="rp-list"
      renderOption={(option, input) => <RadioPill {...input} label={option.label} />}
    />
  )
}
