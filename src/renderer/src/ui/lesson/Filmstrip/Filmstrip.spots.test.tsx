import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Slide } from '@shared/deck/types'
import { Filmstrip } from './Filmstrip'

const slide = (id: string, spots: number): Slide => ({
  id,
  kind: 'content',
  elements: Array.from({ length: spots }, (_, i) => ({
    id: `${id}-spot${i}`,
    type: 'image' as const,
    x: 100,
    y: 100,
    w: 400,
    h: 300,
    fit: 'cover' as const,
    alt: 'A leaf',
    placeholder: { description: 'A leaf in sunlight' }
  }))
})

describe('Filmstrip: picture spot badges', () => {
  it('shows a dashed count badge only on slides with spots and opens that slide’s spot', async () => {
    const onSpotBadge = vi.fn()
    render(
      <Filmstrip
        slides={[slide('a', 0), slide('b', 1), slide('c', 2)]}
        styleProfile={null}
        selectedId="a"
        onSelect={() => {}}
        spotCounts={
          new Map([
            ['b', 1],
            ['c', 2]
          ])
        }
        onSpotBadge={onSpotBadge}
      />
    )
    const strip = within(screen.getByRole('navigation', { name: 'Slides' }))
    expect(strip.queryByRole('button', { name: /^Slide 1 has/ })).not.toBeInTheDocument()
    expect(strip.getByRole('button', { name: 'Slide 2 has 1 picture spot' })).toHaveTextContent('1')
    await userEvent
      .setup()
      .click(strip.getByRole('button', { name: 'Slide 3 has 2 picture spots' }))
    expect(onSpotBadge).toHaveBeenCalledWith('c')
  })

  it('draws a faint dashed box in the thumbnail, without text', () => {
    const { container } = render(
      <Filmstrip
        slides={[slide('b', 1)]}
        styleProfile={null}
        selectedId="b"
        onSelect={() => {}}
        spotCounts={new Map([['b', 1]])}
      />
    )
    expect(container.querySelector('.slide-spot--thumb')).not.toBeNull()
    expect(container.textContent).not.toContain('Picture spot')
  })

  it('draws nothing for spots without the prop', () => {
    const { container } = render(
      <Filmstrip slides={[slide('b', 1)]} styleProfile={null} selectedId="b" onSelect={() => {}} />
    )
    expect(container.querySelector('.slide-spot')).toBeNull()
  })
})
