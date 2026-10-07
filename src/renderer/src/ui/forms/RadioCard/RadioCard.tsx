import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import { cx } from '../internal/cx'
import { ChoiceGroup, type ChoiceGroupProps } from '../internal/ChoiceGroup'
import './RadioCard.css'

export interface RadioCardProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  /** Card title; the radio's accessible name. */
  label: ReactNode
  /** Optional second line; the radio's accessible description. */
  description?: ReactNode
}

/** A card with a native radio, title and optional description (design-system: RadioCard). */
export function RadioCard({ label, description, className, ...input }: RadioCardProps): ReactNode {
  const base = useId()
  const titleId = `${base}-title`
  const descId = `${base}-desc`
  return (
    <label className={cx('rc', className)}>
      <input
        {...input}
        type="radio"
        className="rc__radio"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
      />
      <span className="rc__body">
        <span id={titleId} className="rc__title">
          {label}
        </span>
        {description ? (
          <span id={descId} className="rc__desc">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
}

export type RadioCardGroupProps = Omit<ChoiceGroupProps, 'renderOption' | 'listClassName'>

/** A vertical stack (8px gap) of RadioCards in a fieldset; `description` comes from each option. */
export function RadioCardGroup(props: RadioCardGroupProps): ReactNode {
  return (
    <ChoiceGroup
      {...props}
      listClassName="rc-list"
      renderOption={(option, input) => (
        <RadioCard {...input} label={option.label} description={option.description} />
      )}
    />
  )
}
