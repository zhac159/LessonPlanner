import { Minus, Plus } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '../internal/cx'
import { useControllable } from '../internal/useControllable'
import { useFieldIds } from '../internal/useFieldIds'
import { clamp, parseNumber, stepBy } from './stepMath'
import '../internal/forms.css'
import './NumberStepper.css'

export interface NumberStepperProps {
  /** Visible label and accessible name of the number box (e.g. "How many questions?"). */
  label: string
  /** Controlled value. */
  value?: number
  /** Initial value when uncontrolled (default: `min`, else 0). */
  defaultValue?: number
  /** Called with the new, already clamped value. */
  onChange?: (value: number) => void
  min?: number
  max?: number
  /** Amount added by the buttons and Up/Down (default 1). */
  step?: number
  /** Amount added by PageUp/PageDown (default 5 steps). */
  pageStep?: number
  /** Accessible name of the minus button (e.g. "Fewer questions"). */
  decrementLabel?: string
  /** Accessible name of the plus button (e.g. "More questions"). */
  incrementLabel?: string
  disabled?: boolean
  id?: string
  className?: string
}

/**
 * Number input flanked by minus and plus buttons (design-system: NumberStepper).
 * Keys: Up/Down = ±step, PageUp/PageDown = ±pageStep, Home/End = min/max. Typing is only committed
 * (clamped) when the box loses focus, so the user can pass through values below `min`.
 */
export function NumberStepper({
  label,
  value,
  defaultValue,
  onChange,
  min,
  max,
  step = 1,
  pageStep = step * 5,
  decrementLabel = 'Decrease',
  incrementLabel = 'Increase',
  disabled = false,
  id,
  className
}: NumberStepperProps): ReactNode {
  const { id: inputId } = useFieldIds(id)
  const [current, setCurrent] = useControllable(value, defaultValue ?? min ?? 0, onChange)
  /** What the user is typing; `null` means "show the real value". */
  const [draft, setDraft] = useState<string | null>(null)

  const move = (delta: number): void => {
    setDraft(null)
    setCurrent(stepBy(current, delta, step, min, max))
  }
  const jump = (target: number): void => {
    setDraft(null)
    setCurrent(clamp(target, min, max))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const handlers: Partial<Record<string, () => void>> = {
      ArrowUp: () => move(step),
      ArrowDown: () => move(-step),
      PageUp: () => move(pageStep),
      PageDown: () => move(-pageStep),
      Home: min === undefined ? undefined : () => jump(min),
      End: max === undefined ? undefined : () => jump(max)
    }
    const handler = handlers[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const commitDraft = (text: string): void => {
    const parsed = parseNumber(text)
    if (parsed !== null) setCurrent(clamp(parsed, min, max))
    setDraft(null)
  }

  const atMin = min !== undefined && current <= min
  const atMax = max !== undefined && current >= max

  return (
    <div className={cx('ns', className)}>
      <label htmlFor={inputId} className="ns__label">
        {label}
      </label>
      <div className={cx('ns__group', disabled && 'is-disabled')}>
        <button
          type="button"
          className="ns__btn"
          aria-label={decrementLabel}
          disabled={disabled || atMin}
          onClick={() => move(-step)}
        >
          <Minus size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <input
          id={inputId}
          type="number"
          className="ns__input"
          value={draft ?? String(current)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-valuenow={current}
          aria-valuemin={min}
          aria-valuemax={max}
          onChange={(event) => {
            const text = event.target.value
            setDraft(text)
            const parsed = parseNumber(text)
            if (parsed !== null && clamp(parsed, min, max) === parsed) setCurrent(parsed)
          }}
          onBlur={(event) => commitDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="ns__btn"
          aria-label={incrementLabel}
          disabled={disabled || atMax}
          onClick={() => move(step)}
        >
          <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
