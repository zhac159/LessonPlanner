import type { ComponentType } from 'react'
import { Avatar } from '../../atoms/Avatar/Avatar'
import { cx } from '../../atoms/cx'
import { Tooltip } from '../../atoms/Tooltip/Tooltip'
import './Sidebar.css'

export interface SidebarItem {
  id: string
  label: string
  icon: ComponentType<{ size?: number | string; strokeWidth?: number }>
  /** Items marked `bottom` sit under the spacer (Settings). */
  placement?: 'top' | 'bottom'
}

export interface SidebarUser {
  name: string
  /** "Claude connected" / "Claude isn’t connected". */
  status: string
}

export interface SidebarProps {
  items: ReadonlyArray<SidebarItem>
  /** The item drawn in orange. */
  activeId?: string
  /**
   * `page` (default) when the item is the page being viewed. Use `true` for a parent section that
   * stays highlighted while a child screen is open (Home while editing a lesson).
   */
  current?: 'page' | 'true'
  /** `full` = 224px with labels, `rail` = 72px icons only (focus mode). */
  mode?: 'full' | 'rail'
  user?: SidebarUser | null
  onNavigate: (id: string) => void
  className?: string
}

/** The main navigation. Presentational: the app decides what the items are and what they do. */
export function Sidebar({
  items,
  activeId,
  current = 'page',
  mode = 'full',
  user,
  onNavigate,
  className
}: SidebarProps) {
  const rail = mode === 'rail'
  const renderItem = (item: SidebarItem) => {
    const Icon = item.icon
    const active = item.id === activeId
    const button = (
      <button
        type="button"
        className="ui-sidebar__item"
        data-active={active}
        data-testid={`nav-${item.id}`}
        aria-current={active ? current : undefined}
        aria-label={rail ? item.label : undefined}
        onClick={() => onNavigate(item.id)}
      >
        <Icon size={20} strokeWidth={2} />
        {!rail && <span>{item.label}</span>}
      </button>
    )
    return (
      <li key={item.id}>
        {rail ? (
          <Tooltip label={item.label} placement="right">
            {button}
          </Tooltip>
        ) : (
          button
        )}
      </li>
    )
  }

  const top = items.filter((item) => item.placement !== 'bottom')
  const bottom = items.filter((item) => item.placement === 'bottom')

  return (
    <nav className={cx('ui-sidebar', className)} data-mode={mode} aria-label="Main">
      <ul className="ui-sidebar__group">{top.map(renderItem)}</ul>
      <div className="ui-sidebar__spacer" />
      {bottom.length > 0 && <ul className="ui-sidebar__group">{bottom.map(renderItem)}</ul>}
      {user && (
        <div className="ui-sidebar__profile" data-testid="sidebar-user">
          {rail ? (
            <Avatar name={`${user.name}, ${user.status}`} />
          ) : (
            <>
              <Avatar name={user.name} />
              <div className="ui-sidebar__who">
                <span className="ui-sidebar__name">{user.name}</span>
                <span className="ui-sidebar__status">{user.status}</span>
              </div>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
