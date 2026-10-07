import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AssetGrid, GRID_WINDOW } from './AssetGrid'

const make = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `a${i}`, label: `Item ${i}` }))

function Demo({
  n,
  columns = 3,
  windowSize
}: {
  n: number
  columns?: number
  windowSize?: number
}) {
  return (
    <AssetGrid
      items={make(n)}
      getKey={(item) => item.id}
      label="Your assets"
      columns={columns}
      windowSize={windowSize}
      empty={<p>Nothing here.</p>}
      renderItem={(item, itemProps) => (
        <button type="button" {...itemProps}>
          {item.label}
        </button>
      )}
    />
  )
}

describe('AssetGrid', () => {
  it('is one labelled group with one tab stop', () => {
    render(<Demo n={5} />)
    expect(screen.getByRole('group', { name: 'Your assets' })).toBeInTheDocument()
    const stops = screen.getAllByRole('button').filter((b) => b.tabIndex === 0)
    expect(stops).toHaveLength(1)
    expect(stops[0]).toHaveTextContent('Item 0')
  })

  it('Tab enters the grid once and Tab again leaves it', async () => {
    render(
      <>
        <Demo n={4} />
        <button type="button">After</button>
      </>
    )
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Item 0' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
  })

  it('arrow keys move focus and the tab stop follows', async () => {
    render(<Demo n={7} columns={3} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Item 1' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Item 1' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('button', { name: 'Item 0' })).toHaveAttribute('tabindex', '-1')
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Item 4' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('button', { name: 'Item 3' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('button', { name: 'Item 0' })).toHaveFocus()
  })

  it('stops at the edges and Home and End jump', async () => {
    render(<Demo n={5} columns={3} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}')
    expect(screen.getByRole('button', { name: 'Item 0' })).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('button', { name: 'Item 4' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Item 4' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('button', { name: 'Item 0' })).toHaveFocus()
  })

  it('shows the empty content when there are no items', () => {
    render(<Demo n={0} />)
    expect(screen.getByText('Nothing here.')).toBeInTheDocument()
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('draws a window beyond 120 items and reveals the rest with "Show more"', async () => {
    render(<Demo n={GRID_WINDOW + 30} />)
    expect(screen.getAllByRole('button', { name: /^Item/ })).toHaveLength(GRID_WINDOW)
    await userEvent.click(screen.getByRole('button', { name: 'Show more (30 left)' }))
    expect(screen.getAllByRole('button', { name: /^Item/ })).toHaveLength(GRID_WINDOW + 30)
    expect(screen.queryByRole('button', { name: /Show more/ })).toBeNull()
  })

  it('has no "Show more" when everything fits', () => {
    render(<Demo n={10} windowSize={10} />)
    expect(screen.queryByRole('button', { name: /Show more/ })).toBeNull()
  })
})
