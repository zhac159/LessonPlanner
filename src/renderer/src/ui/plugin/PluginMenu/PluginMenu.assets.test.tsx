import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PluginSummary } from '@shared/contracts/deck-builder-plugins'
import { PluginMenu } from './PluginMenu'

const quiz: PluginSummary = {
  id: 'quiz',
  name: 'Quiz',
  description: 'Quick-check questions',
  icon: 'list-checks',
  tint: 'peach',
  scope: 'lesson',
  hasInputs: true,
  needsSlides: false,
  order: 1
}

function setup(addAsset: { showNew: boolean; disabled?: boolean } | undefined) {
  const onChoose = vi.fn()
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(
    <PluginMenu
      open
      plugins={[quiz]}
      onSelect={onSelect}
      onClose={onClose}
      onManage={() => {}}
      addAsset={addAsset && { ...addAsset, onChoose }}
    />
  )
  return { onChoose, onSelect, onClose, menu: screen.getByRole('menu') }
}

describe('PluginMenu: the built-in Add asset tile', () => {
  it('is titled "What shall we add?", with the tile first and the plugins under "MAKE WITH CLAUDE"', () => {
    const { menu } = setup({ showNew: true })
    expect(within(menu).getByText('What shall we add?')).toBeInTheDocument()
    const tile = within(menu).getByRole('menuitem', { name: /Add asset/ })
    expect(tile).toHaveAttribute('aria-description', 'A logo, icon or picture from your library')
    expect(within(tile).getByText('A logo, icon or picture from your library')).toBeInTheDocument()
    expect(within(tile).getByText('New')).toBeInTheDocument()
    const label = within(menu).getByText('MAKE WITH CLAUDE')
    const quizTile = within(menu).getByRole('menuitem', { name: /Quiz/ })
    expect(tile.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(label.compareDocumentPosition(quizTile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('has no New pill once it has been used enough', () => {
    const { menu } = setup({ showNew: false })
    expect(within(menu).queryByText('New')).not.toBeInTheDocument()
  })

  it('takes focus first; Enter chooses it and closes the menu', async () => {
    const { onChoose, onClose, menu } = setup({ showNew: true })
    expect(within(menu).getByRole('menuitem', { name: /Add asset/ })).toHaveFocus()
    await userEvent.setup().keyboard('{Enter}')
    expect(onChoose).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('arrows walk from it to the plugins like any other tile', async () => {
    const { menu } = setup({ showNew: true })
    const user = userEvent.setup()
    await user.keyboard('{ArrowDown}')
    expect(within(menu).getByRole('menuitem', { name: /Quiz/ })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(within(menu).getByRole('menuitem', { name: /Add asset/ })).toHaveFocus()
  })

  it('does not exist without the prop: the menu is the plugin menu as before', () => {
    const { menu } = setup(undefined)
    expect(within(menu).getByText('What shall we make?')).toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: /Add asset/ })).not.toBeInTheDocument()
  })

  it('stays out of a search: only plugins are searched', async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      ...quiz,
      id: `p${i}`,
      name: `Plug ${i}`,
      order: i
    }))
    render(
      <PluginMenu
        open
        plugins={many}
        onSelect={() => {}}
        onClose={() => {}}
        onManage={() => {}}
        addAsset={{ showNew: true, onChoose: vi.fn() }}
      />
    )
    await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Find a plugin' }), 'Plug 3')
    expect(screen.queryByRole('menuitem', { name: /Add asset/ })).not.toBeInTheDocument()
  })
})
