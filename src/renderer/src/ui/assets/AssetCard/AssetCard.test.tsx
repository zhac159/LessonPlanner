import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssetCard } from './AssetCard'

const base = { title: 'School logo', name: 'school_logo', kind: 'logo', usedInCount: 14 } as const

describe('AssetCard', () => {
  it('shows the title, the name pill, the kind and the lesson count', () => {
    render(<AssetCard {...base} />)
    expect(screen.getByText('School logo')).toBeInTheDocument()
    expect(screen.getByText('school_logo')).toBeInTheDocument()
    expect(screen.getByText('Logo')).toBeInTheDocument()
    expect(screen.getByText('14 lessons')).toBeInTheDocument()
  })

  it.each([
    [1, '1 lesson'],
    [0, 'Not used yet']
  ])('counts %s as "%s"', (count, text) => {
    render(<AssetCard {...base} usedInCount={count} />)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('hides the count when it is not given', () => {
    render(<AssetCard title="Owl" name="owl" kind="character" />)
    expect(screen.queryByText(/lesson|Not used/)).toBeNull()
  })

  it('selects on click and Enter, with aria-pressed and the orange state', async () => {
    const onSelect = vi.fn()
    const { container, rerender } = render(<AssetCard {...base} onSelect={onSelect} />)
    const card = screen.getByRole('button', { name: /School logo/ })
    expect(card).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(card)
    card.focus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(2)
    rerender(<AssetCard {...base} selected onSelect={onSelect} />)
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(container.firstElementChild).toHaveAttribute('data-selected', 'true')
  })

  it('has no checkbox unless selectable', () => {
    render(<AssetCard {...base} />)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('in selection mode shows a labelled checkbox and ticks on click, Space and the box', async () => {
    const onCheckedChange = vi.fn()
    const onSelect = vi.fn()
    render(<AssetCard {...base} selectable onSelect={onSelect} onCheckedChange={onCheckedChange} />)
    const box = screen.getByRole('checkbox', { name: 'Select School logo' })
    expect(box).not.toBeChecked()
    await userEvent.click(box)
    expect(onCheckedChange).toHaveBeenLastCalledWith(true)
    const card = screen.getByRole('button', { name: /School logo/ })
    await userEvent.click(card)
    expect(onCheckedChange).toHaveBeenLastCalledWith(true)
    card.focus()
    await userEvent.keyboard(' ')
    expect(onCheckedChange).toHaveBeenCalledTimes(3)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows the ticked state and unticks', async () => {
    const onCheckedChange = vi.fn()
    render(<AssetCard {...base} selectable checked onCheckedChange={onCheckedChange} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByRole('button', { name: /School logo/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await userEvent.click(screen.getByRole('button', { name: /School logo/ }))
    expect(onCheckedChange).toHaveBeenLastCalledWith(false)
  })

  it('draws the picture with empty alt text', () => {
    const { container } = render(<AssetCard {...base} thumbSrc="data:image/png;base64,AA" />)
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })
})
