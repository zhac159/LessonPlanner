import type { ChromeMode, UiModule } from '../core/types'

/** In focus mode (the rail) this section stays highlighted while a hidden child screen is open. */
export const FOCUS_PARENT_ID = 'home'

/** One sidebar entry. Structurally the same as `SidebarItem` in `@ui/chrome`. */
export interface NavItem {
  id: string
  label: string
  icon: UiModule['icon']
  placement: 'top' | 'bottom'
}

export interface NavModel {
  items: NavItem[]
  /** The item to draw in orange, if any. */
  highlightId: string | undefined
  /** `page` for the page itself, `true` for a parent section standing in for a child screen. */
  current: 'page' | 'true'
}

/**
 * Turn the loaded modules into sidebar items (hidden ones are excluded; `bottom` ones go under
 * the spacer) and decide which item is highlighted for the active module.
 */
export function buildNav(
  modules: ReadonlyArray<Pick<UiModule, 'id' | 'title' | 'icon' | 'nav'>>,
  activeId: string,
  chrome: ChromeMode
): NavModel {
  const items: NavItem[] = modules
    .filter((module) => module.nav !== 'hidden')
    .map((module) => ({
      id: module.id,
      label: module.title,
      icon: module.icon,
      placement: module.nav === 'bottom' ? 'bottom' : 'top'
    }))

  if (items.some((item) => item.id === activeId)) {
    return { items, highlightId: activeId, current: 'page' }
  }
  if (chrome === 'rail') {
    const parent = items.find((item) => item.id === FOCUS_PARENT_ID) ?? items[0]
    return { items, highlightId: parent?.id, current: 'true' }
  }
  return { items, highlightId: undefined, current: 'page' }
}

/** The sidebar's status line under the user's name. */
export function claudeStatus(connected: boolean): string {
  return connected ? 'Claude connected' : 'Claude isn’t connected'
}
