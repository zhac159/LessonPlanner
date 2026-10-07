import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../atoms/cx'
import { useFocusScope } from '../internal/focus'
import { firstEnabled, lastEnabled, matchTypeahead, nextEnabled } from './menuNav'
import { clampToViewport, type Point } from './position'
import './ContextMenu.css'

export interface MenuItem {
  id: string
  label: string
  /** Optional leading icon (unsized lucide icon). */
  icon?: ReactNode
  /** Destructive items ("Delete…") are drawn in the error colour. */
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

export interface ContextMenuProps {
  open: boolean
  /** Top-left corner to open at, in viewport pixels (see `anchorBelow`). */
  anchor: Point | null
  items: ReadonlyArray<MenuItem>
  /** Called after an item runs, and for Esc, Tab and clicks outside. */
  onClose: () => void
  /** Accessible name, e.g. "Lesson actions". */
  label: string
}

const TYPEAHEAD_RESET_MS = 600

/**
 * A menu of actions. Arrow keys, Home and End move between items (disabled ones are skipped),
 * typing a letter jumps, Enter or Space runs, Esc closes and returns focus to the opener.
 */
export function ContextMenu({ open, anchor, items, onClose, label }: ContextMenuProps) {
  const menu = useRef<HTMLDivElement>(null)
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const typed = useRef({ text: '', timer: undefined as ReturnType<typeof setTimeout> | undefined })
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState<Point | null>(anchor)

  useFocusScope(menu, open)

  useEffect(() => {
    if (open) setActive(Math.max(firstEnabled(items), 0))
    // Only when the menu opens: later item changes must not steal the user's place.
  }, [open])

  // Place the menu at the anchor, then nudge it back inside the window if it overflows.
  useLayoutEffect(() => {
    if (!open || !anchor) return
    const el = menu.current
    const size = { width: el?.offsetWidth ?? 0, height: el?.offsetHeight ?? 0 }
    setPosition(
      clampToViewport(anchor, size, { width: window.innerWidth, height: window.innerHeight })
    )
  }, [open, anchor])

  // A press anywhere outside closes the menu.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (!menu.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, onClose])

  useEffect(() => () => clearTimeout(typed.current.timer), [])

  if (!open || !anchor) return null

  const focusItem = (index: number): void => {
    if (index < 0) return
    setActive(index)
    refs.current[index]?.focus()
  }

  const select = (item: MenuItem): void => {
    if (item.disabled) return
    item.onSelect()
    onClose()
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        return focusItem(nextEnabled(items, active, 1))
      case 'ArrowUp':
        event.preventDefault()
        return focusItem(nextEnabled(items, active, -1))
      case 'Home':
        event.preventDefault()
        return focusItem(firstEnabled(items))
      case 'End':
        event.preventDefault()
        return focusItem(lastEnabled(items))
      case 'Escape':
        event.preventDefault()
        return onClose()
      case 'Tab':
        return onClose()
    }
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.key !== ' '
    ) {
      clearTimeout(typed.current.timer)
      typed.current.text += event.key
      typed.current.timer = setTimeout(() => (typed.current.text = ''), TYPEAHEAD_RESET_MS)
      focusItem(matchTypeahead(items, active, typed.current.text))
    }
  }

  const first = Math.max(firstEnabled(items), 0)
  return createPortal(
    <div
      ref={menu}
      className="ui-menu"
      role="menu"
      aria-label={label}
      style={{ left: (position ?? anchor).x, top: (position ?? anchor).y }}
      onKeyDown={onKeyDown}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(el) => {
            refs.current[index] = el
          }}
          type="button"
          role="menuitem"
          className={cx('ui-menu__item', item.danger && 'ui-menu__item--danger')}
          tabIndex={index === active ? 0 : -1}
          aria-disabled={item.disabled || undefined}
          data-autofocus={index === first ? '' : undefined}
          onClick={() => select(item)}
          onMouseMove={() => !item.disabled && index !== active && setActive(index)}
        >
          {item.icon && (
            <span className="ui-menu__icon" aria-hidden="true">
              {item.icon}
            </span>
          )}
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}
