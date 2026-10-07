import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement
} from 'react'
import { cx } from '../cx'
import './Tooltip.css'

/** Hover delay before the tooltip appears. Keyboard focus shows it immediately. */
export const TOOLTIP_DELAY_MS = 400

export interface TooltipProps {
  /** The tooltip text (also the visible name of icon-only controls). */
  label: string
  /** Where the bubble sits relative to the control. The rail uses `right`. */
  placement?: 'top' | 'right'
  /** The single control the tooltip describes. It receives `aria-describedby` while shown. */
  children: ReactElement<{ 'aria-describedby'?: string }>
  className?: string
}

/** Ink bubble shown after a short hover or on focus; Esc dismisses it. */
export function Tooltip({ label, placement = 'top', children, className }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const clear = useCallback(() => clearTimeout(timer.current), [])
  const show = useCallback(
    (delay: number) => {
      clear()
      if (delay === 0) setOpen(true)
      else timer.current = setTimeout(() => setOpen(true), delay)
    },
    [clear]
  )
  const hide = useCallback(() => {
    clear()
    setOpen(false)
  }, [clear])
  useEffect(() => clear, [clear])

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      hide()
    }
  }

  return (
    <span
      className={cx('ui-tooltip-host', className)}
      onMouseEnter={() => show(TOOLTIP_DELAY_MS)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
      onKeyDown={onKeyDown}
    >
      {cloneElement(children, open ? { 'aria-describedby': id } : {})}
      {open && (
        <span role="tooltip" id={id} className="ui-tooltip" data-placement={placement}>
          {label}
        </span>
      )}
    </span>
  )
}
