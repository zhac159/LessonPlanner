import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AssetFilterId } from '@shared/assets/library'
import { FilterPills } from './FilterPills'

const counts: Record<AssetFilterId, number> = {
  all: 12,
  logos: 1,
  icons: 6,
  pictures: 1,
  diagrams: 2,
  banners: 1,
  characters: 1,
  'symbol-cards': 0
}

describe('FilterPills', () => {
  it('shows All with its count and the kind pills, but not Symbol cards when she has none', () => {
    render(<FilterPills counts={counts} value="all" onChange={() => {}} />)
    const names = screen.getAllByRole('button').map((b) => b.textContent)
    expect(names).toEqual([
      'All · 12',
      'Logos',
      'Icons',
      'Pictures',
      'Diagrams',
      'Banners',
      'Characters'
    ])
  })

  it('shows Symbol cards once she has some', () => {
    render(
      <FilterPills counts={{ ...counts, 'symbol-cards': 3 }} value="all" onChange={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'Symbol cards' })).toBeInTheDocument()
  })

  it('marks the chosen pill pressed', () => {
    render(<FilterPills counts={counts} value="icons" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Icons' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All · 12' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('reports a new choice and ignores a click on the one that is on', async () => {
    const onChange = vi.fn()
    render(<FilterPills counts={counts} value="icons" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Logos' }))
    expect(onChange).toHaveBeenCalledWith('logos')
    await userEvent.click(screen.getByRole('button', { name: 'Icons' }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('can drop the count (the picker) and hide pills', () => {
    render(
      <FilterPills
        counts={counts}
        value="all"
        onChange={() => {}}
        showCount={false}
        hide={['banners']}
      />
    )
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Banners' })).toBeNull()
  })

  it('is a named group that can scroll sideways', () => {
    render(<FilterPills counts={counts} value="all" onChange={() => {}} scroll label="Kinds" />)
    const group = screen.getByRole('group', { name: 'Kinds' })
    expect(group).toHaveAttribute('data-scroll', 'true')
  })
})
