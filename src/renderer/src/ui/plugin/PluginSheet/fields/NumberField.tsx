import { useState, type FocusEvent } from 'react'
import { NumberStepper } from '../../../forms/NumberStepper/NumberStepper'
import type { FieldProps } from './types'

/**
 * A `number` input: a NumberStepper. The stepper clamps what is typed when it loses focus; this
 * wrapper says so ("Choose between 3 and 30.") when the typed number was out of range.
 */
export function NumberField({ input, value, onChange }: FieldProps<'number', number>) {
  const [note, setNote] = useState<string | null>(null)

  const clear = (): void => setNote(null)

  const onBlur = (event: FocusEvent<HTMLElement>): void => {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    const typed = Number(target.value)
    const outside = target.value.trim() !== '' && (typed < input.min || typed > input.max)
    setNote(outside ? `Choose between ${input.min} and ${input.max}.` : null)
  }

  return (
    <div
      className="plugin-sheet__number"
      onBlur={onBlur}
      onChange={clear}
      onClick={clear}
      onKeyDown={clear}
    >
      <NumberStepper
        label={input.label}
        value={value}
        onChange={onChange}
        min={input.min}
        max={input.max}
        step={input.step}
        decrementLabel={input.decrementLabel}
        incrementLabel={input.incrementLabel}
      />
      {note && (
        <p className="plugin-sheet__error" role="alert">
          {note}
        </p>
      )}
    </div>
  )
}
