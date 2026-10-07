import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssetPicker, type PickerAsset } from './AssetPicker'

const mk = (
  name: string,
  title: string,
  kind: PickerAsset['kind'],
  used?: string
): PickerAsset => ({
  id: `id_${name}`,
  name,
  title,
  kind,
  thumbDataUrl: null,
  tags: [],
  lastUsedAt: used ?? null,
  createdAt: '2026-01-01T00:00:00Z'
})

const ASSETS = [
  mk('school_logo', 'School logo', 'logo', '2026-03-03T00:00:00Z'),
  mk('do_now_banner', 'Do Now banner', 'banner', '2026-03-02T00:00:00Z'),
  mk('timer_icon', '5-minute timer', 'icon', '2026-03-01T00:00:00Z'),
  mk('owl_mascot', 'Owl mascot', 'character'),
  mk('beaker_icon', 'Beaker', 'icon'),
  mk('microscope_icon', 'Microscope', 'icon')
]

describe('AssetPicker (insert)', () => {
  it('shows search, pills, "RECENTLY USED" (newest first) and "ALL ASSETS · N" and the tip', () => {
    render(<AssetPicker mode="insert" assets={ASSETS} onPick={() => {}} onOpenLibrary={() => {}} />)
    expect(screen.getByRole('searchbox', { name: 'Search assets' })).toHaveAttribute(
      'placeholder',
      'Search: logo, beaker, owl…'
    )
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    const recent = screen.getByRole('region', { name: 'RECENTLY USED' })
    expect(
      within(recent)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['school_logo', 'do_now_banner', 'timer_icon'])
    expect(screen.getByRole('heading', { name: 'ALL ASSETS · 6' })).toBeInTheDocument()
    expect(screen.getByText(/Tip: type/)).toHaveTextContent('Tip: type {{ in the chat to pick one')
    expect(screen.getByRole('button', { name: 'Open library' })).toBeInTheDocument()
  })

  it('picks on click and with Enter', async () => {
    const onPick = vi.fn()
    render(<AssetPicker mode="insert" assets={ASSETS} onPick={onPick} />)
    const all = screen.getByRole('region', { name: 'All assets' })
    await userEvent.click(within(all).getByRole('button', { name: 'owl_mascot' }))
    expect(onPick).toHaveBeenLastCalledWith('id_owl_mascot')
    within(all).getByRole('button', { name: 'beaker_icon' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(onPick).toHaveBeenLastCalledWith('id_beaker_icon')
  })

  it('pre-focuses the first tile when asked and arrows cross from recent to all', async () => {
    render(<AssetPicker mode="insert" assets={ASSETS} onPick={() => {}} autoFocus />)
    const first = within(screen.getByRole('region', { name: 'RECENTLY USED' })).getByRole(
      'button',
      {
        name: 'school_logo'
      }
    )
    expect(first).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    const all = screen.getByRole('region', { name: 'All assets' })
    expect(within(all).getByRole('button', { name: 'school_logo' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(within(all).getByRole('button', { name: 'do_now_banner' })).toHaveFocus()
  })

  it('filters by what is typed and Enter picks the first match', async () => {
    const onPick = vi.fn()
    render(<AssetPicker mode="insert" assets={ASSETS} onPick={onPick} />)
    await userEvent.type(screen.getByRole('searchbox'), 'beak')
    expect(screen.getByRole('heading', { name: 'ALL ASSETS · 1' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'RECENTLY USED' })).toBeNull()
    await userEvent.keyboard('{Enter}')
    expect(onPick).toHaveBeenCalledWith('id_beaker_icon')
  })

  it('ArrowDown in the search box moves to the first tile', async () => {
    render(<AssetPicker mode="insert" assets={ASSETS} onPick={() => {}} />)
    await userEvent.click(screen.getByRole('searchbox'))
    await userEvent.keyboard('{ArrowDown}')
    expect(
      within(screen.getByRole('region', { name: 'RECENTLY USED' })).getByRole('button', {
        name: 'school_logo'
      })
    ).toHaveFocus()
  })

  it('filters by kind and reports the choice', async () => {
    const onFilterChange = vi.fn()
    render(
      <AssetPicker
        mode="insert"
        assets={ASSETS}
        onPick={() => {}}
        onFilterChange={onFilterChange}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Icons' }))
    expect(onFilterChange).toHaveBeenCalledWith('icons')
    expect(screen.getByRole('heading', { name: 'ALL ASSETS · 3' })).toBeInTheDocument()
  })

  it('says so when nothing matches', async () => {
    render(<AssetPicker mode="insert" assets={ASSETS} onPick={() => {}} />)
    await userEvent.type(screen.getByRole('searchbox'), 'zebra')
    expect(screen.getByRole('status')).toHaveTextContent('No asset called “zebra”.')
  })

  it('reports query changes to the parent', async () => {
    const onQueryChange = vi.fn()
    render(
      <AssetPicker mode="insert" assets={ASSETS} onPick={() => {}} onQueryChange={onQueryChange} />
    )
    await userEvent.type(screen.getByRole('searchbox'), 'ow')
    expect(onQueryChange).toHaveBeenLastCalledWith('ow')
  })

  it('Esc calls onEscape and leaves the text alone', async () => {
    const onEscape = vi.fn()
    render(<AssetPicker mode="insert" assets={ASSETS} onPick={() => {}} onEscape={onEscape} />)
    await userEvent.type(screen.getByRole('searchbox'), 'ow{Escape}')
    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('searchbox')).toHaveValue('ow')
  })

  it('typed-token mode hides the search box and filters by the typed letters', () => {
    render(<AssetPicker mode="insert" assets={ASSETS} onPick={() => {}} typedQuery="sch" />)
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.getByRole('heading', { name: 'ALL ASSETS · 1' })).toBeInTheDocument()
  })
})

describe('AssetPicker (empty library)', () => {
  it('invites her to open the library or find online', async () => {
    const onOpenLibrary = vi.fn()
    const onFindOnline = vi.fn()
    render(
      <AssetPicker
        mode="insert"
        assets={[]}
        onPick={() => {}}
        onOpenLibrary={onOpenLibrary}
        onFindOnline={onFindOnline}
      />
    )
    expect(screen.getByText(/You don't have any assets yet\./)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter by kind' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Open library' }))
    await userEvent.click(screen.getByRole('button', { name: 'Find online' }))
    expect(onOpenLibrary).toHaveBeenCalledTimes(1)
    expect(onFindOnline).toHaveBeenCalledTimes(1)
  })
})

describe('AssetPicker (place and spot)', () => {
  const featured = [ASSETS[3]!, ASSETS[4]!, ASSETS[5]!]

  it('place mode says "SUGGESTED FOR THIS SLIDE", marks the chosen tile and has no tip', () => {
    render(
      <AssetPicker
        mode="place"
        assets={ASSETS}
        featured={featured}
        selectedIds={['id_owl_mascot']}
        onPick={() => {}}
        searchPlaceholder="Search your assets…"
      />
    )
    const suggested = screen.getByRole('region', { name: 'SUGGESTED FOR THIS SLIDE' })
    expect(within(suggested).getByRole('button', { name: 'owl_mascot' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Search your assets…')
    expect(screen.queryByText(/Tip: type/)).toBeNull()
  })

  it('spot mode says "SUGGESTED FOR THIS SPOT"', () => {
    render(<AssetPicker mode="spot" assets={ASSETS} featured={featured} onPick={() => {}} />)
    expect(screen.getByRole('region', { name: 'SUGGESTED FOR THIS SPOT' })).toBeInTheDocument()
  })

  it('place mode shows no featured row without suggestions', () => {
    render(<AssetPicker mode="place" assets={ASSETS} onPick={() => {}} />)
    expect(screen.queryByRole('region', { name: /SUGGESTED/ })).toBeNull()
  })

  it('multi mode shows every picked tile pressed', () => {
    render(
      <AssetPicker
        mode="place"
        assets={ASSETS}
        selection="multi"
        selectedIds={['id_owl_mascot', 'id_beaker_icon']}
        onPick={() => {}}
      />
    )
    const all = screen.getByRole('region', { name: 'All assets' })
    expect(within(all).getAllByRole('button', { pressed: true })).toHaveLength(2)
  })
})
