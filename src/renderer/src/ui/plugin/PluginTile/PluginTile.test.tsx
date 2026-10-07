import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PluginTile } from './PluginTile'

describe('PluginTile', () => {
  it('is a menu item named by the plugin with a decorative icon', () => {
    render(<PluginTile name="Quiz" icon="list-checks" tone="peach" />)
    const tile = screen.getByRole('menuitem', { name: 'Quiz' })
    expect(tile.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('carries its tone for the fill', () => {
    render(<PluginTile name="Quiz" icon="list-checks" tone="peach" />)
    expect(screen.getByRole('menuitem')).toHaveAttribute('data-tone', 'peach')
  })

  it('describes itself to assistive technology and as a tooltip', async () => {
    render(
      <PluginTile name="Quiz" icon="list-checks" tone="peach" description="Quick-check questions" />
    )
    const tile = screen.getByRole('menuitem')
    expect(tile).toHaveAttribute('aria-description', 'Quick-check questions')
    await userEvent.tab()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Quick-check questions')
  })

  it('shows the description inline in list mode', () => {
    render(
      <PluginTile
        name="Quiz"
        icon="list-checks"
        tone="peach"
        description="Quick-check questions"
        showDescription
      />
    )
    expect(screen.getByText('Quick-check questions')).toBeVisible()
  })

  it('falls back to a generic icon for an unknown name', () => {
    render(<PluginTile name="Odd" icon="nope" tone="sky" />)
    expect(screen.getByRole('menuitem').querySelector('svg')).not.toBeNull()
  })

  it('calls onClick', async () => {
    const onClick = vi.fn()
    render(<PluginTile name="Quiz" icon="list-checks" tone="peach" onClick={onClick} />)
    await userEvent.click(screen.getByRole('menuitem'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is inert but focusable when disabled, and says why', async () => {
    const onClick = vi.fn()
    render(
      <PluginTile
        name="Differentiate"
        icon="users"
        tone="sky"
        description="Support and stretch versions"
        disabled
        disabledReason="Circle something first"
        onClick={onClick}
      />
    )
    const tile = screen.getByRole('menuitem')
    expect(tile).toHaveAttribute('aria-disabled', 'true')
    await userEvent.tab()
    expect(tile).toHaveFocus()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Circle something first')
    await userEvent.click(tile)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders the dashed "More plugins" variant', () => {
    render(<PluginTile name="More plugins" icon="plus" tone="more" />)
    expect(screen.getByRole('menuitem', { name: 'More plugins' })).toHaveAttribute(
      'data-tone',
      'more'
    )
  })
})
