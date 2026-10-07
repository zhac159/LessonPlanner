import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LearnedCard } from './LearnedCard'

const renderCard = (items: readonly string[] | null, limit?: number) =>
  render(
    <LearnedCard
      title="Layout habits"
      items={items}
      limit={limit}
      itemKey={(item) => item}
      renderItem={(item) => item}
    />
  )

describe('LearnedCard', () => {
  it('lists the rows under a heading that names the section', () => {
    renderCard(['One', 'Two'])
    const region = screen.getByRole('region', { name: 'Layout habits' })
    expect(within(region).getByRole('heading', { level: 3 })).toHaveTextContent('Layout habits')
    expect(
      within(region)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual(['One', 'Two'])
  })

  it('shows three hidden skeleton rows and aria-busy while nothing is learned', () => {
    const { container } = renderCard(null)
    expect(screen.getByRole('region', { name: 'Layout habits' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(container.querySelectorAll('.lc__skeleton')).toHaveLength(3)
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says so when the list is learned but empty', () => {
    renderCard([])
    expect(screen.getByText('Nothing picked up yet.')).toBeInTheDocument()
    expect(screen.getByRole('region')).not.toHaveAttribute('aria-busy')
  })

  it('shows only the first rows past the limit and toggles with Show all / Show fewer', async () => {
    const user = userEvent.setup()
    renderCard(['a', 'b', 'c', 'd'], 2)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    const toggle = screen.getByRole('button', { name: 'Show all' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )

    await user.click(screen.getByRole('button', { name: 'Show fewer' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('has no toggle when the rows fit the limit exactly', () => {
    renderCard(['a', 'b'], 2)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
