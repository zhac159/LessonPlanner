import { Check } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../internal/cx'
import { firstEnabled, lastEnabled, nextEnabled, typeaheadIndex } from '../internal/listNav'
import { computePlacement, type Placement } from './placement'
import type { SelectChipOption } from './types'

export interface SelectChipMenuProps {
  options: SelectChipOption[]
  /** The currently selected value (marked with a check). */
  value: string | undefined
  /** The chip that opened the menu (positioning, outside-click and focus return). */
  anchor: HTMLElement
  id: string
  /** Accessible name of the listbox. */
  label: string
  onSelect: (value: string) => void
  /** `restoreFocus` is true when the keyboard closed the menu and focus should go back to the chip. */
  onClose: (restoreFocus: boolean) => void
}

const TYPEAHEAD_RESET_MS = 600

/**
 * The listbox popover of a SelectChip. Rendered in a portal with fixed positioning so scroll
 * containers cannot clip it. Focus moves to the listbox; the active option is announced through
 * `aria-activedescendant`.
 */
export function SelectChipMenu({
  options,
  value,
  anchor,
  id,
  label,
  onSelect,
  onClose
}: SelectChipMenuProps): ReactNode {
  const listRef = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', timer: 0 })
  const disabled = options.map((o) => Boolean(o.disabled))
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [active, setActive] = useState(() => {
    const selected = options.findIndex((o) => o.value === value && !o.disabled)
    return selected >= 0 ? selected : firstEnabled(disabled)
  })
  const [usingKeyboard, setUsingKeyboard] = useState(false)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const rect = anchor.getBoundingClientRect()
    list.style.minWidth = `${rect.width}px`
    setPlacement(
      computePlacement({
        anchor: rect,
        menuWidth: list.offsetWidth,
        menuHeight: list.offsetHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      })
    )
    list.focus({ preventScroll: true })
  }, [anchor])

  useEffect(() => {
    const close = (event: Event): void => {
      const target = event.target as Node | null
      if (target && (listRef.current?.contains(target) || anchor.contains(target))) return
      onClose(false)
    }
    const closeOnViewportChange = (event: Event): void => {
      if (event.target instanceof Node && listRef.current?.contains(event.target)) return
      onClose(false)
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange, true)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('resize', closeOnViewportChange)
      window.removeEventListener('scroll', closeOnViewportChange, true)
      window.clearTimeout(typed.current.timer)
    }
  }, [anchor, onClose])

  useEffect(() => {
    const el = document.getElementById(`${id}-opt-${active}`)
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [active, id])

  const select = (index: number): void => {
    const option = options[index]
    if (option && !option.disabled) onSelect(option.value)
  }

  const typeAhead = (char: string): void => {
    window.clearTimeout(typed.current.timer)
    typed.current.text += char
    typed.current.timer = window.setTimeout(() => (typed.current.text = ''), TYPEAHEAD_RESET_MS)
    const hit = typeaheadIndex(
      options.map((o) => o.label),
      disabled,
      typed.current.text,
      active
    )
    if (hit >= 0) setActive(hit)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    setUsingKeyboard(true)
    const move = (to: number): void => {
      event.preventDefault()
      if (to >= 0) setActive(to)
    }
    switch (event.key) {
      case 'ArrowDown':
        return move(nextEnabled(disabled, active, 1))
      case 'ArrowUp':
        return move(nextEnabled(disabled, active, -1))
      case 'Home':
        return move(firstEnabled(disabled))
      case 'End':
        return move(lastEnabled(disabled))
      case 'Enter':
      case ' ':
        if (event.key === ' ' && typed.current.text) return typeAhead(' ')
        event.preventDefault()
        return select(active)
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        return onClose(true)
      case 'Tab':
        return onClose(true)
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault()
          typeAhead(event.key)
        }
    }
  }

  const style = placement
    ? {
        top: placement.top,
        left: placement.left,
        transformOrigin: `${placement.originX}px ${placement.side === 'below' ? '-8px' : 'calc(100% + 8px)'}`
      }
    : { top: 0, left: 0, visibility: 'hidden' as const }

  return createPortal(
    <ul
      ref={listRef}
      id={id}
      role="listbox"
      aria-label={label}
      aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
      tabIndex={-1}
      className={cx('sc-menu', usingKeyboard && 'sc-menu--keyboard')}
      style={style}
      onKeyDown={handleKeyDown}
      onMouseMove={() => usingKeyboard && setUsingKeyboard(false)}
    >
      {options.map((option, index) => (
        <li
          key={option.value}
          id={`${id}-opt-${index}`}
          role="option"
          aria-selected={option.value === value}
          aria-disabled={option.disabled || undefined}
          className={cx(
            'sc-option',
            option.value === value && 'is-selected',
            index === active && 'is-active',
            option.disabled && 'is-disabled'
          )}
          onMouseEnter={() => !option.disabled && setActive(index)}
          onClick={() => select(index)}
        >
          {option.leading}
          <span className="sc-option__label">{option.label}</span>
          {option.value === value ? <Check size={16} strokeWidth={2.4} aria-hidden="true" /> : null}
        </li>
      ))}
    </ul>,
    document.body
  )
}
