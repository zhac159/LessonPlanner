import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AssetChip } from '@shared/contracts/assets'
import { AssetsFoundCard, type AssetsFound } from './AssetsFoundCard'
import { PictureHabitsCard } from './PictureHabitsCard'

const chip = (name: string): AssetChip => ({
  assetId: `id_${name}`,
  name,
  kind: 'logo',
  thumbDataUrl: null,
  removed: false
})

const found = (over: Partial<AssetsFound> = {}): AssetsFound => ({
  found: 12,
  suggested: 9,
  saved: 0,
  batchId: 'rvb_1',
  preview: [
    'school_logo',
    'do_now_banner',
    'owl_mascot',
    'beaker_icon',
    'timer_icon',
    'plant_cell'
  ].map(chip),
  ...over
})

describe('PictureHabitsCard', () => {
  const lines = [
    'A picture on the right of most content slides, about a third of the slide',
    '{{school_logo}} in the top-right corner on every slide',
    'No pictures on objectives, exit-ticket slides'
  ]

  it('lists the lines with a tick each and draws `{{name}}` as a chip', () => {
    render(<PictureHabitsCard lines={lines} state="ready" decks={8} />)
    const card = screen.getByRole('region', { name: 'Picture habits' })
    expect(within(card).getAllByRole('listitem')).toHaveLength(3)
    expect(within(card).getByText('school_logo')).toBeInTheDocument()
    expect(within(card).getByText(/in the top-right corner on every slide/)).toBeInTheDocument()
    expect(within(card).queryByText(/Based on 1 deck/)).toBeNull()
  })

  it('shows the chip’s picture when the tiles know it', () => {
    render(
      <PictureHabitsCard
        lines={lines}
        state="ready"
        decks={3}
        chips={[{ ...chip('school_logo'), thumbDataUrl: 'data:image/png;base64,AAA' }]}
      />
    )
    expect(document.querySelector('img[src="data:image/png;base64,AAA"]')).not.toBeNull()
  })

  it('shows three skeleton rows and no text while files are still being read', () => {
    render(<PictureHabitsCard lines={[]} state="building" decks={0} />)
    const card = screen.getByRole('region', { name: 'Picture habits' })
    expect(card).toHaveAttribute('aria-busy', 'true')
    expect(card.querySelectorAll('.cs-picture__skeleton')).toHaveLength(3)
    expect(within(card).queryByText(/No pictures/)).toBeNull()
  })

  it('says so when her files hold no pictures', () => {
    render(<PictureHabitsCard lines={[]} state="none" decks={4} />)
    expect(screen.getByText('No pictures found in these files.')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('a single deck gets the caption "Based on 1 deck. More decks make this surer."', () => {
    render(<PictureHabitsCard lines={lines} state="ready" decks={1} />)
    expect(screen.getByText('Based on 1 deck. More decks make this surer.')).toBeInTheDocument()
  })
})

describe('AssetsFoundCard', () => {
  it('shows the count pill, the lead text, six tiles and a dark "Review assets" button', async () => {
    const onReview = vi.fn()
    render(<AssetsFoundCard found={found()} onReview={onReview} onOpenAssets={vi.fn()} />)
    const card = screen.getByRole('region', { name: 'Assets I found' })
    expect(within(card).getByText('12 found · 9 suggested')).toBeInTheDocument()
    expect(
      within(card).getByText(/Logos, icons and pictures you reuse across your decks/)
    ).toBeInTheDocument()
    expect(within(card).getAllByRole('button', { pressed: false })).toHaveLength(6)
    expect(within(card).getByText('school_logo')).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Review assets' }))
    expect(onReview).toHaveBeenCalledOnce()
  })

  it('a tile also opens the review', async () => {
    const onReview = vi.fn()
    render(<AssetsFoundCard found={found()} onReview={onReview} onOpenAssets={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'owl_mascot' }))
    expect(onReview).toHaveBeenCalledOnce()
  })

  it('after she keeps them it reads "9 saved to Your assets" and the button is "Open Assets"', async () => {
    const onOpenAssets = vi.fn()
    render(
      <AssetsFoundCard
        found={found({ saved: 9, batchId: null })}
        onReview={vi.fn()}
        onOpenAssets={onOpenAssets}
      />
    )
    expect(screen.getByText('9 saved to Your assets')).toBeInTheDocument()
    expect(screen.queryByText(/found ·/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Open Assets' }))
    expect(onOpenAssets).toHaveBeenCalledOnce()
  })

  it('with nothing waiting and nothing saved the review button is inert', async () => {
    const onReview = vi.fn()
    render(
      <AssetsFoundCard
        found={found({ batchId: null })}
        onReview={onReview}
        onOpenAssets={vi.fn()}
      />
    )
    const button = screen.getByRole('button', { name: 'Review assets' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(button)
    expect(onReview).not.toHaveBeenCalled()
  })

  it('shows at most six tiles', () => {
    const many = Array.from({ length: 9 }, (_, i) => chip(`pic_${i}`))
    render(
      <AssetsFoundCard found={found({ preview: many })} onReview={vi.fn()} onOpenAssets={vi.fn()} />
    )
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(6)
  })
})
