import { Fragment, useId, type ReactNode } from 'react'
import { cx } from './cx'
import { useControllable } from './useControllable'
import './ChoiceGroup.css'
import './forms.css'

export interface ChoiceOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

/** What a radio `<input>` needs to take part in the group. */
export interface ChoiceInputProps {
  name: string
  value: string
  checked: boolean
  disabled: boolean
  onChange: () => void
}

export interface ChoiceGroupProps {
  /** Names the group (rendered as the `<legend>`). */
  legend: string
  hideLegend?: boolean
  options: ChoiceOption[]
  /** Controlled selected value. */
  value?: string
  /** Initial value when uncontrolled (default: nothing selected). */
  defaultValue?: string
  onChange?: (value: string) => void
  /** Disables every option. */
  disabled?: boolean
  /** Native `name` shared by the radios (generated when omitted). */
  name?: string
  className?: string
  /** Class of the element wrapping the options (layout differs per kit component). */
  listClassName?: string
  renderOption: (option: ChoiceOption, input: ChoiceInputProps) => ReactNode
}

/**
 * The shared radio-group shell behind RadioPillGroup and RadioCardGroup: a fieldset + legend, one
 * native radio per option (so arrow keys work natively) and controlled/uncontrolled value state.
 */
export function ChoiceGroup({
  legend,
  hideLegend,
  options,
  value,
  defaultValue,
  onChange,
  disabled = false,
  name,
  className,
  listClassName,
  renderOption
}: ChoiceGroupProps): ReactNode {
  const autoName = useId()
  const groupName = name ?? autoName
  const [current, setCurrent] = useControllable<string>(value, defaultValue ?? '', onChange)

  return (
    <fieldset className={cx('choice', className)} disabled={disabled}>
      <legend className={cx('choice__legend', hideLegend && 'fk-sr-only')}>{legend}</legend>
      <div className={listClassName}>
        {options.map((option) => (
          <Fragment key={option.value}>
            {renderOption(option, {
              name: groupName,
              value: option.value,
              checked: current === option.value,
              disabled: Boolean(option.disabled),
              onChange: () => setCurrent(option.value)
            })}
          </Fragment>
        ))}
      </div>
    </fieldset>
  )
}
