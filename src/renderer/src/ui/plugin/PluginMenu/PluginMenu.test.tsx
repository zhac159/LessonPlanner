import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PluginSummary } from '@shared/contracts/deck-builder-plugins'
import { PluginMenu, type PluginMenuProps } from './PluginMenu'

const make = (
  id: string,
  name: string,
  scope: PluginSummary['scope'] = 'lesson',
  order = 1
): PluginSummary => ({
  id,
  name,
  description: `${name} description`,
  icon: 'plus',
  tint: 'peach',
  scope,
  hasInputs: true,
  needsSlides: false,
  order
})

const FIVE = [
  make('quiz', 'Quiz', 'lesson', 1),
  make('differentiate', 'Differentiate', 'lesson', 2),
  make('worksheet', 'Worksheet', 'lesson', 3),
  make('speaker-notes', 'Speaker notes', 'lesson', 4),
  make('starter', 'Starter & plenary', 'lesson', 5)
]

function setup(props: Partial<PluginMenuProps> = {}) {
  const handlers = { onSelect: vi.fn(), onClose: vi.fn(), onManage: vi.fn() }
  const user = userEvent.setup()
  const utils = render(<PluginMenu open plugins={FIVE} {...handlers} {...props} />)
  return { user, ...handlers, ...utils }
}

const tile = (name: string) => screen.getByRole('menuitem', { name })

describe('PluginMenu', () => {
  it('renders nothing while closed', () => {
    setup({ open: false })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('is a menu titled "What shall we make?" with a tile per plugin, More plugins and Manage', () => {
    setup()
    const menu = screen.getByRole('menu', { name: 'What shall we make?' })
    const items = within(menu).getAllByRole('menuitem')
    expect(items.map((i) => i.textContent)).toEqual([
      'Manage',
      'Quiz',
      'Differentiate',
      'Worksheet',
      'Speaker notes',
      'Starter & plenary',
      'More plugins'
    ])
  })

  it('focuses the first tile on opening', () => {
    setup()
    expect(tile('Quiz')).toHaveFocus()
  })

  it('focuses the first tile that is available', () => {
    setup({ unavailableReason: (p) => (p.id === 'quiz' ? 'Make your slides first' : null) })
    expect(tile('Differentiate')).toHaveFocus()
  })

  it('has one tab stop (roving tabindex)', () => {
    setup()
    const stops = screen.getAllByRole('menuitem').filter((i) => i.tabIndex === 0)
    expect(stops).toHaveLength(1)
    expect(stops[0]).toBe(tile('Quiz'))
  })

  describe('choosing', () => {
    it('runs a plugin on click, then closes', async () => {
      const { user, onSelect, onClose } = setup()
      await user.click(tile('Worksheet'))
      expect(onSelect).toHaveBeenCalledWith(FIVE[2])
      expect(onClose).toHaveBeenCalled()
    })

    it('runs the focused plugin with Enter and with Space', async () => {
      const { user, onSelect } = setup()
      await user.keyboard('{Enter}')
      await user.keyboard('{ArrowRight}')
      await user.keyboard(' ')
      expect(onSelect.mock.calls.map(([p]) => p.id)).toEqual(['quiz', 'differentiate'])
    })

    it('opens the Plugins page from "Manage" and from "More plugins"', async () => {
      const { user, onManage, onClose } = setup()
      await user.click(tile('Manage'))
      await user.click(tile('More plugins'))
      expect(onManage).toHaveBeenCalledTimes(2)
      expect(onClose).toHaveBeenCalledTimes(2)
    })

    it('does nothing for an unavailable plugin and explains why', async () => {
      const { user, onSelect, onClose } = setup({
        unavailableReason: (p) => (p.id === 'differentiate' ? 'Circle something first' : null)
      })
      const disabled = tile('Differentiate')
      expect(disabled).toHaveAttribute('aria-disabled', 'true')
      await user.click(disabled)
      expect(onSelect).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
      disabled.focus()
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Circle something first')
    })
  })

  describe('keyboard', () => {
    it('moves ±1 with Left and Right and ±2 with Up and Down', async () => {
      const { user } = setup()
      await user.keyboard('{ArrowRight}')
      expect(tile('Differentiate')).toHaveFocus()
      await user.keyboard('{ArrowDown}')
      expect(tile('Speaker notes')).toHaveFocus()
      await user.keyboard('{ArrowLeft}')
      expect(tile('Worksheet')).toHaveFocus()
      await user.keyboard('{ArrowUp}')
      expect(tile('Quiz')).toHaveFocus()
    })

    it('reaches Manage with Up from the first row and returns with Down', async () => {
      const { user } = setup()
      await user.keyboard('{ArrowUp}')
      expect(tile('Manage')).toHaveFocus()
      await user.keyboard('{ArrowDown}')
      expect(tile('Quiz')).toHaveFocus()
    })

    it('jumps with Home and End', async () => {
      const { user } = setup()
      await user.keyboard('{End}')
      expect(tile('More plugins')).toHaveFocus()
      await user.keyboard('{Home}')
      expect(tile('Quiz')).toHaveFocus()
    })

    it('jumps to the next tile whose name starts with the typed letter', async () => {
      const { user } = setup()
      await user.keyboard('s')
      expect(tile('Speaker notes')).toHaveFocus()
      await user.keyboard('s')
      expect(tile('Starter & plenary')).toHaveFocus()
    })

    it('asks to close on Esc and gives focus back to the "+" button', async () => {
      function Host() {
        const [open, setOpen] = useState(true)
        const plus = useRef<HTMLButtonElement>(null)
        return (
          <>
            <button ref={plus} onClick={() => setOpen((o) => !o)}>
              Plus
            </button>
            <PluginMenu
              open={open}
              plugins={FIVE}
              onSelect={() => {}}
              onManage={() => {}}
              onClose={() => setOpen(false)}
              returnFocusRef={plus}
            />
          </>
        )
      }
      const user = userEvent.setup()
      render(<Host />)
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Plus' })).toHaveFocus()
    })

    it('closes when Tab moves focus out of the menu', async () => {
      const { user, onClose } = setup()
      render(<button>After</button>)
      await user.tab()
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('click outside', () => {
    it('closes on a press outside', async () => {
      const { user, onClose } = setup()
      render(<button>Elsewhere</button>)
      await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
      expect(onClose).toHaveBeenCalled()
    })

    it('does not close on a press inside, or on the "+" button (it toggles itself)', async () => {
      const plus = document.createElement('button')
      document.body.append(plus)
      const { user, onClose } = setup({ returnFocusRef: { current: plus } })
      await user.click(screen.getByText('What shall we make?'))
      await user.click(plus)
      expect(onClose).not.toHaveBeenCalled()
      plus.remove()
    })
  })

  describe('scopes', () => {
    const mixed = [
      make('quiz', 'Quiz', 'lesson', 1),
      make('notes', 'Speaker notes', 'slides', 2),
      make('rewrite', 'Rewrite', 'region', 3)
    ]

    it('groups under headings when there is more than one scope', () => {
      setup({ plugins: mixed })
      expect(screen.getByRole('group', { name: 'Whole lesson' })).toContainElement(tile('Quiz'))
      expect(screen.getByRole('group', { name: 'This slide' })).toContainElement(
        tile('Speaker notes')
      )
      expect(screen.getByRole('group', { name: 'Circled area' })).toContainElement(tile('Rewrite'))
    })

    it('shows no headings for a single scope', () => {
      setup()
      expect(screen.queryByText('Whole lesson')).not.toBeInTheDocument()
    })
  })

  describe('search', () => {
    const many = Array.from({ length: 9 }, (_, i) => make(`p${i}`, `Plugin ${i}`, 'lesson', i))

    it('appears only with more than 8 plugins', () => {
      setup()
      expect(screen.queryByRole('searchbox', { name: 'Find a plugin' })).not.toBeInTheDocument()
      setup({ plugins: many })
      expect(screen.getByRole('searchbox', { name: 'Find a plugin' })).toBeInTheDocument()
    })

    it('filters tiles by name, drops "More plugins" and says when nothing matches', async () => {
      const { user } = setup({ plugins: many })
      const box = screen.getByRole('searchbox', { name: 'Find a plugin' })
      await user.type(box, 'plugin 3')
      expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
        'Manage',
        'Plugin 3'
      ])
      await user.clear(box)
      await user.type(box, 'zzz')
      expect(screen.getByText(/No plugins match/)).toBeInTheDocument()
    })

    it('moves from the search field to the first tile with ArrowDown and does not type-ahead', async () => {
      const { user } = setup({ plugins: many })
      await user.click(screen.getByRole('searchbox', { name: 'Find a plugin' }))
      await user.keyboard('p')
      expect(screen.getByRole('searchbox')).toHaveFocus()
      await user.keyboard('{Backspace}{ArrowDown}')
      expect(tile('Plugin 0')).toHaveFocus()
    })
  })
})
