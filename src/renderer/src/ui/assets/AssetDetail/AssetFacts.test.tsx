import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssetFacts } from './AssetFacts'

const deck = (fileName: string, page: number | null) => ({
  styleId: null,
  sourceId: 's',
  fileName,
  page
})

describe('AssetFacts', () => {
  it('says where it was found and how many lessons use it', () => {
    const foundIn = [
      deck('Y8 Photosynthesis.pptx', 1),
      ...Array.from({ length: 23 }, () => deck('x', 2))
    ]
    const { container } = render(
      <AssetFacts
        asset={{ foundIn, sourceKind: 'extracted', usedInCount: 14 }}
        onOpenUsage={() => {}}
      />
    )
    expect(container).toHaveTextContent(
      'Found in Y8 Photosynthesis.pptx, slide 1 and 23 other decks'
    )
    expect(container).toHaveTextContent('Used in 14 lessons')
  })

  it('makes the lesson count a link that opens the usage', async () => {
    const onOpenUsage = vi.fn()
    render(
      <AssetFacts
        asset={{ foundIn: [], sourceKind: 'uploaded', usedInCount: 14 }}
        onOpenUsage={onOpenUsage}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: '14 lessons' }))
    expect(onOpenUsage).toHaveBeenCalledTimes(1)
  })

  it('shows "Added by you" when it was not found in a deck', () => {
    render(<AssetFacts asset={{ foundIn: [], sourceKind: 'uploaded', usedInCount: 1 }} />)
    expect(screen.getByText('Added by you')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it.each([
    ['online', 'Picked online'],
    ['generated', 'Made with Claude']
  ] as const)('shows "%s" assets as "%s"', (sourceKind, text) => {
    render(<AssetFacts asset={{ foundIn: [], sourceKind, usedInCount: 0 }} />)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('shows "Not used yet" without a link at zero', () => {
    render(
      <AssetFacts
        asset={{ foundIn: [], sourceKind: 'uploaded', usedInCount: 0 }}
        onOpenUsage={() => {}}
      />
    )
    expect(screen.getByText(/Not used yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
