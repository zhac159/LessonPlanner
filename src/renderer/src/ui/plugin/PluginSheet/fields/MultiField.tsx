import { useEffect, useId, useRef } from 'react'
import { Checkbox } from '../../../forms/Checkbox/Checkbox'
import { CheckboxGroup } from '../../../forms/Checkbox/CheckboxGroup'
import type { FieldProps } from './types'

/**
 * A `multi` input: a group of checkboxes, kept in the manifest's option order. Its error shows under
 * the group and the group's fieldset is marked `aria-invalid`.
 */
export function MultiField({ input, value, onChange, error }: FieldProps<'multi', string[]>) {
  const host = useRef<HTMLDivElement>(null)
  const errorId = useId()

  // CheckboxGroup has no error props; mark its fieldset from here.
  useEffect(() => {
    const fieldset = host.current?.querySelector('fieldset')
    if (!fieldset) return
    if (error) {
      fieldset.setAttribute('aria-invalid', 'true')
      fieldset.setAttribute('aria-describedby', errorId)
    } else {
      fieldset.removeAttribute('aria-invalid')
      fieldset.removeAttribute('aria-describedby')
    }
  }, [error, errorId])

  const toggle = (optionValue: string, checked: boolean): void => {
    const next = new Set(value)
    if (checked) next.add(optionValue)
    else next.delete(optionValue)
    onChange(input.options.map((o) => o.value).filter((v) => next.has(v)))
  }

  return (
    <div ref={host}>
      <CheckboxGroup legend={input.label}>
        {input.options.map((option) => (
          <Checkbox
            key={option.value}
            label={option.label}
            checked={value.includes(option.value)}
            onChange={(checked) => toggle(option.value, checked)}
          />
        ))}
      </CheckboxGroup>
      {error && (
        <p id={errorId} className="plugin-sheet__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
