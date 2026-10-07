import { ChevronDown } from 'lucide-react'
import {
  useCallback,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { cx } from '../internal/cx'
import { useControllable } from '../internal/useControllable'
import { SelectChipMenu } from './SelectChipMenu'
import type { SelectChipOption } from './types'
import './SelectChip.css'

export type { SelectChipOption }

export interface SelectChipProps {
  /** The setting's name, e.g. "Style". The chip is named "Style: Science KS3. Change style". */
  label: string
  options: SelectChipOption[]
  /** Controlled value. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  onChange?: (value: string) => void
  /** `md` = 44 high, `sm` = 40 high. */
  size?: 'md' | 'sm'
  /** Leading icon that overrides the selected option's `leading` (e.g. a timer for lesson length). */
  leading?: ReactNode
  /** Chip text when no option is selected. */
  placeholder?: string
  disabled?: boolean
  className?: string
}

/** A pill that opens a listbox popover to choose one value (design-system: SelectChip). */
export function SelectChip({
  label,
  options,
  value,
  defaultValue,
  onChange,
  size = 'md',
  leading,
  placeholder = 'Choose',
  disabled = false,
  className
}: SelectChipProps): ReactNode {
  const [current, setCurrent] = useControllable<string | undefined>(value, defaultValue, (v) => {
    if (v !== undefined) onChange?.(v)
  })
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const selected = options.find((o) => o.value === current)
  const text = selected?.label ?? placeholder

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
    }
  }

  return (
    <span className={cx('sc', className)}>
      <button
        ref={triggerRef}
        type="button"
        className={cx('sc__chip', `sc__chip--${size}`, open && 'is-open')}
        style={selected?.fill ? ({ '--sc-fill': selected.fill } as CSSProperties) : undefined}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${label}: ${text}. Change ${label.toLowerCase()}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
      >
        {leading ?? selected?.leading}
        <span className="sc__text" title={text}>
          {text}
        </span>
        <ChevronDown
          size={size === 'md' ? 16 : 14}
          strokeWidth={size === 'md' ? 2.2 : 2.4}
          className="sc__chevron"
          aria-hidden="true"
        />
      </button>
      {open && triggerRef.current ? (
        <SelectChipMenu
          id={menuId}
          label={label}
          options={options}
          value={current}
          anchor={triggerRef.current}
          onSelect={(v) => {
            setCurrent(v)
            close(true)
          }}
          onClose={close}
        />
      ) : null}
    </span>
  )
}
