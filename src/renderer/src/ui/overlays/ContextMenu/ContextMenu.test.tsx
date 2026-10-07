import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ContextMenu, type MenuItem } from './ContextMenu'

function makeItems(overrides: Partial<Record<string, Partial<MenuItem>>> = {}) {
  const select = {
    open: vi.fn(),
    duplicate: vi.fn(),
    export: vi.fn(),
    delete: vi.fn()
  }
  const items: MenuItem[] = [
    { id: 'open', label: 'Open', onSelect: select.open, ...overrides.open },
    { id: 'duplicate', label: 'Duplicate', onSelect: select.duplicate, ...overrides.duplicate },
    { id: 'export', label: 'Export to PowerPoint', onSelect: select.export, ...overrides.export },
    { id: 'delete', label: 'Delete…', danger: true, onSelect: select.delete, ...overrides.delete }
  ]
  return { items, select }
}

function Harness({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Lesson menu</button>
      <ContextMenu
        open={open}
        anchor={{ x: 20, y: 30 }}
        items={items}
        label="Lesson actions"
        onClose={() => setOpen(false)}
      />
    </>
  )
}

async function openMenu(items: MenuItem[]) {
  const user = userEvent.setup()
  render(<Harness items={items} />)
  await user.click(screen.getByText('Lesson menu'))
  return user
}

describe('ContextMenu', () => {
  it('renders nothing while closed', () => {
    render(
      <ContextMenu
        open={false}
        anchor={{ x: 0, y: 0 }}
        items={makeItems().items}
        label="x"
        onClose={() => {}}
      />
    )
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens as a labelled menu of menuitems at the anchor and focuses the first item', async () => {
    await openMenu(makeItems().items)
    const menu = screen.getByRole('menu', { name: 'Lesson actions' })
    expect(menu).toHaveStyle({ left: '20px', top: '30px' })
    expect(screen.getAllByRole('menuitem')).toHaveLength(4)
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
  })

  it('moves focus with the arrow keys, wrapping at both ends, using a roving tabindex', async () => {
    const user = await openMenu(makeItems().items)
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveFocus()
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveAttribute('tabindex', '-1')
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Delete…' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
  })

  it('jumps with Home and End', async () => {
    const user = await openMenu(makeItems().items)
    await user.keyboard('{End}')
    expect(screen.getByRole('menuitem', { name: 'Delete…' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
  })

  it('skips disabled items and never runs them', async () => {
    const { items, select } = makeItems({ duplicate: { disabled: true } })
    const user = await openMenu(items)
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Export to PowerPoint' })).toHaveFocus()
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(select.duplicate).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  it('jumps to an item by typing its first letter', async () => {
    const user = await openMenu(makeItems().items)
    await user.keyboard('e')
    expect(screen.getByRole('menuitem', { name: 'Export to PowerPoint' })).toHaveFocus()
  })

  it('runs the focused item with Enter, closes, and returns focus to the opener', async () => {
    const { items, select } = makeItems()
    const user = await openMenu(items)
    await user.keyboard('{ArrowDown}{Enter}')
    expect(select.duplicate).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByText('Lesson menu')).toHaveFocus()
  })

  it('runs an item with Space and with a click', async () => {
    const { items, select } = makeItems()
    const user = await openMenu(items)
    await user.keyboard('{ArrowDown}{ArrowDown} ')
    expect(select.export).toHaveBeenCalledTimes(1)
    await user.click(screen.getByText('Lesson menu'))
    await user.click(screen.getByRole('menuitem', { name: 'Delete…' }))
    expect(select.delete).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the opener', async () => {
    const user = await openMenu(makeItems().items)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByText('Lesson menu')).toHaveFocus()
  })

  it('closes when clicking outside', async () => {
    const user = await openMenu(makeItems().items)
    await user.click(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Tab without trapping focus', async () => {
    const user = await openMenu(makeItems().items)
    await user.tab()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('marks destructive items', async () => {
    await openMenu(makeItems().items)
    expect(screen.getByRole('menuitem', { name: 'Delete…' })).toHaveClass('ui-menu__item--danger')
  })
})
