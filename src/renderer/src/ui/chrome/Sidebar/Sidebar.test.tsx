import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Blocks, House, Palette, SlidersHorizontal } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { Sidebar, type SidebarProps } from './Sidebar'

const ITEMS: SidebarProps['items'] = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'styles', label: 'Styles', icon: Palette },
  { id: 'plugins', label: 'Plugins', icon: Blocks },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal, placement: 'bottom' }
]

function setup(props: Partial<SidebarProps> = {}) {
  const onNavigate = vi.fn()
  render(<Sidebar items={ITEMS} activeId="home" onNavigate={onNavigate} {...props} />)
  return { onNavigate }
}

describe('Sidebar (full)', () => {
  it('is a navigation landmark named Main with a labelled button per item', () => {
    setup()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const label of ['Home', 'Styles', 'Plugins', 'Settings']) {
      expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(nav).toHaveAttribute('data-mode', 'full')
  })

  it('marks only the active item as the current page', () => {
    setup({ activeId: 'styles' })
    expect(screen.getByRole('button', { name: 'Styles' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Styles' })).toHaveAttribute('data-active', 'true')
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('uses aria-current="true" for a parent section highlighted during a child screen', () => {
    setup({ activeId: 'home', current: 'true' })
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'true')
  })

  it('navigates on click and with Enter, and keeps test ids', async () => {
    const user = userEvent.setup()
    const { onNavigate } = setup()
    await user.click(screen.getByTestId('nav-plugins'))
    expect(onNavigate).toHaveBeenLastCalledWith('plugins')
    screen.getByRole('button', { name: 'Styles' }).focus()
    await user.keyboard('{Enter}')
    expect(onNavigate).toHaveBeenLastCalledWith('styles')
  })

  it('puts bottom-placed items after the top group', () => {
    setup()
    const buttons = screen.getAllByRole('button').map((b) => b.textContent)
    expect(buttons).toEqual(['Home', 'Styles', 'Plugins', 'Settings'])
    const settings = screen.getByRole('button', { name: 'Settings' })
    expect(settings.closest('ul')).not.toBe(
      screen.getByRole('button', { name: 'Home' }).closest('ul')
    )
  })

  it('shows the user chip with name and Claude status', () => {
    setup({ user: { name: 'Alice', status: 'Claude connected' } })
    expect(screen.getByText('Claude connected')).toBeInTheDocument()
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: 'Alice' })).toHaveTextContent('A')
  })

  it('shows no chip without a user', () => {
    setup({ user: null })
    expect(screen.queryByTestId('sidebar-user')).not.toBeInTheDocument()
  })
})

describe('Sidebar (rail)', () => {
  it('hides labels but keeps accessible names on every item', () => {
    setup({ mode: 'rail' })
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveAttribute('data-mode', 'rail')
    expect(screen.getByRole('button', { name: 'Home' }).textContent).toBe('')
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
  })

  it('shows a tooltip on keyboard focus', async () => {
    setup({ mode: 'rail' })
    await userEvent.tab()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Home')
  })

  it('describes the user in the avatar’s name', () => {
    setup({ mode: 'rail', user: { name: 'Alice', status: 'Claude isn’t connected' } })
    expect(screen.getByRole('img', { name: 'Alice, Claude isn’t connected' })).toBeInTheDocument()
  })

  it('still navigates', async () => {
    const { onNavigate } = setup({ mode: 'rail' })
    await userEvent.click(screen.getByRole('button', { name: 'Styles' }))
    expect(onNavigate).toHaveBeenCalledWith('styles')
  })
})
