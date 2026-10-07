import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BasedOnStrip } from './BasedOnStrip'

const ITEMS = [
  { id: 'a', name: 'beaker_icon', thumbSrc: 'data:image/png;base64,AA' },
  { id: 'b', name: 'microscope_icon' },
  { id: 'c', name: 'timer_icon' }
]

describe('BasedOnStrip', () => {
  it('is a labelled section with a heading and one thumbnail per picked asset', () => {
    const { container } = render(<BasedOnStrip items={ITEMS} />)
    expect(screen.getByRole('region', { name: 'Based on' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Based on' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('names each thumbnail for screen readers', () => {
    render(<BasedOnStrip items={ITEMS} />)
    expect(screen.getByText('beaker_icon')).toBeInTheDocument()
  })

  it('has named × buttons that unpick one asset', async () => {
    const onRemove = vi.fn()
    render(<BasedOnStrip items={ITEMS} onRemove={onRemove} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove microscope_icon' }))
    expect(onRemove).toHaveBeenCalledWith('b')
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('has no × buttons for a fixed list', () => {
    render(<BasedOnStrip items={ITEMS} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('asks her to pick some when there are none', () => {
    render(<BasedOnStrip items={[]} />)
    expect(screen.getByText('Tick a few assets to show the look you want.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })
})
