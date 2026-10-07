import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { House, Palette, SlidersHorizontal } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import type { ShellState, UiModule } from '../core/types'
import { Sidebar } from './Sidebar'
import { ShellProvider } from './testShell'

const Page = () => null
const mod = (id: string, title: string, extra: Partial<UiModule> = {}): UiModule => ({
  id,
  title,
  icon: House,
  component: Page,
  ...extra
})

const MODULES: UiModule[] = [
  mod('home', 'Home'),
  mod('styles', 'Styles', { icon: Palette }),
  mod('settings', 'Settings', { icon: SlidersHorizontal, nav: 'bottom' }),
  mod('new-lesson', 'New lesson', { nav: 'hidden' })
]

function renderSidebar(overrides: Partial<ShellState> = {}) {
  const navigate = vi.fn()
  render(
    <ShellProvider shell={{ modules: MODULES, activeId: 'home', navigate, ...overrides }}>
      <Sidebar />
    </ShellProvider>
  )
  return { navigate }
}

describe('Sidebar (wired)', () => {
  it('lists visible modules and hides `hidden` ones', () => {
    renderSidebar()
    expect(screen.getByTestId('nav-home')).toBeInTheDocument()
    expect(screen.getByTestId('nav-styles')).toBeInTheDocument()
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-new-lesson')).not.toBeInTheDocument()
  })

  it('navigates to the clicked module', async () => {
    const { navigate } = renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: 'Styles' }))
    expect(navigate).toHaveBeenCalledWith('styles')
  })

  it('marks the active module as the current page', () => {
    renderSidebar({ activeId: 'styles' })
    expect(screen.getByTestId('nav-styles')).toHaveAttribute('aria-current', 'page')
  })

  it('shows the user chip with Claude status', () => {
    renderSidebar({ user: { name: 'Alice', claudeConnected: false } })
    expect(screen.getByText('Claude isn’t connected')).toBeInTheDocument()
  })

  it('omits the chip before there is a user', () => {
    renderSidebar({ user: null })
    expect(screen.queryByTestId('sidebar-user')).not.toBeInTheDocument()
  })

  it('becomes the rail in focus mode and keeps Home highlighted for a hidden screen', () => {
    renderSidebar({ chrome: 'rail', activeId: 'new-lesson' })
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveAttribute('data-mode', 'rail')
    expect(screen.getByTestId('nav-home')).toHaveAttribute('aria-current', 'true')
  })

  it('renders nothing when the chrome is none', () => {
    renderSidebar({ chrome: 'none' })
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
