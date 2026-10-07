import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedTabs, panelId, tabId } from './SegmentedTabs'

const TABS = [
  { id: 'mine', label: 'Your assets · 12' },
  { id: 'online', label: 'Find online' },
  { id: 'make', label: 'Make one' }
]

function Demo({ onChange }: { onChange?: (id: string) => void }) {
  const [value, setValue] = useState('mine')
  return (
    <SegmentedTabs
      tabs={TABS}
      value={value}
      label="Assets"
      idPrefix="as"
      onChange={(id) => {
        setValue(id)
        onChange?.(id)
      }}
    />
  )
}

describe('SegmentedTabs', () => {
  it('is a tablist with the chosen tab selected and the only tab stop', () => {
    render(<Demo />)
    expect(screen.getByRole('tablist', { name: 'Assets' })).toBeInTheDocument()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Your assets · 12', 'Find online', 'Make one'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('tabindex', '0')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
    expect(tabs[1]).toHaveAttribute('tabindex', '-1')
  })

  it('points the selected tab at the shared panel id', () => {
    render(<Demo />)
    expect(screen.getByRole('tab', { name: 'Your assets · 12' })).toHaveAttribute(
      'aria-controls',
      panelId('as')
    )
    expect(screen.getByRole('tab', { name: 'Find online' })).toHaveAttribute(
      'id',
      tabId('as', 'online')
    )
  })

  it('does not point at a panel unless it is given an id prefix', () => {
    render(<SegmentedTabs tabs={TABS} value="mine" label="Assets" onChange={() => {}} />)
    expect(screen.getAllByRole('tab')[0]).not.toHaveAttribute('aria-controls')
  })

  it('changes on click', async () => {
    const onChange = vi.fn()
    render(<Demo onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Find online' }))
    expect(onChange).toHaveBeenCalledWith('online')
    expect(screen.getByRole('tab', { name: 'Find online' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('moves with the arrow keys, wraps, and Home and End jump', async () => {
    render(<Demo />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Find online' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Find online' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Make one' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Your assets · 12' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Make one' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Your assets · 12' })).toHaveFocus()
  })

  it('draws an optional icon as decoration', () => {
    render(
      <SegmentedTabs
        tabs={[{ id: 'a', label: 'A', icon: <svg data-testid="icon" /> }]}
        value="a"
        onChange={() => {}}
        label="x"
        variant="sheet"
      />
    )
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('tablist')).toHaveAttribute('data-variant', 'sheet')
  })
})
