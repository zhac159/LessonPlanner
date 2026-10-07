import { Sidebar as SidebarView } from '@ui/chrome'
import { useShell } from '../core/ShellContext'
import { buildNav, claudeStatus } from './navModel'

/**
 * The shell's navigation: the loaded modules as sidebar items, full or as the 72px rail
 * depending on the active screen's chrome. Renders nothing when the chrome is `none`.
 */
export function Sidebar() {
  const { modules, activeId, navigate, chrome, user } = useShell()
  if (chrome === 'none') return null

  const { items, highlightId, current } = buildNav(modules, activeId, chrome)
  return (
    <SidebarView
      items={items}
      activeId={highlightId}
      current={current}
      mode={chrome === 'rail' ? 'rail' : 'full'}
      user={user ? { name: user.name, status: claudeStatus(user.claudeConnected) } : null}
      onNavigate={(id) => navigate(id)}
    />
  )
}
