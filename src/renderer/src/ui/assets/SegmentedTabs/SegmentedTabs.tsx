import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '../../atoms/cx'
import './SegmentedTabs.css'

export interface SegmentedTab {
  id: string
  label: string
  /** An unsized lucide icon. */
  icon?: ReactNode
}

export interface SegmentedTabsProps {
  tabs: readonly SegmentedTab[]
  value: string
  onChange: (id: string) => void
  /** Names the tab list: "Assets". */
  label: string
  /** page = the A1/A8/A9 tabs (dark chosen tab); sheet = full-width tabs in a sheet. */
  variant?: 'page' | 'sheet'
  /** Pass the same prefix to `tabId`/`panelId` so panels can point back at their tab. */
  idPrefix?: string
  className?: string
}

export const tabId = (prefix: string, id: string): string => `${prefix}-tab-${id}`
export const panelId = (prefix: string): string => `${prefix}-panel`

/** Real tabs (a tablist with arrow keys): "Your assets · 12" / "Find online", or "Your assets" / "Find online" / "Make one". */
export function SegmentedTabs({
  tabs,
  value,
  onChange,
  label,
  variant = 'page',
  idPrefix,
  className
}: SegmentedTabsProps) {
  const list = useRef<HTMLDivElement>(null)
  const prefix = idPrefix ?? 'as'

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = tabs.findIndex((tab) => tab.id === value)
    const last = tabs.length - 1
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1
    if (next < 0) return
    event.preventDefault()
    const tab = tabs[next]!
    onChange(tab.id)
    list.current?.querySelector<HTMLElement>(`[data-tab="${tab.id}"]`)?.focus()
  }

  return (
    <div
      ref={list}
      role="tablist"
      aria-label={label}
      className={cx('as-tabs', className)}
      data-variant={variant}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId(prefix, tab.id)}
            data-tab={tab.id}
            aria-selected={selected}
            aria-controls={selected && idPrefix ? panelId(idPrefix) : undefined}
            tabIndex={selected ? 0 : -1}
            className="as-tabs__tab"
            onClick={() => onChange(tab.id)}
          >
            {tab.icon && (
              <span className="as-tabs__icon" aria-hidden="true">
                {tab.icon}
              </span>
            )}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
