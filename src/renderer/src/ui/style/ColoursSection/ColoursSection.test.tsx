import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { sampleData } from '../galleryData'
import { COLOUR_LIMIT, ColoursSection } from './ColoursSection'

const colours = sampleData.colours ?? []

describe('ColoursSection', () => {
  it('lists each learned colour with its name and usage', () => {
    render(<ColoursSection colours={colours.slice(0, 3)} />)
    const region = screen.getByRole('region', { name: 'Colours' })
    expect(within(region).getAllByRole('listitem')).toHaveLength(3)
    const first = colours[0]
    expect(within(region).getByText(first.label)).toBeInTheDocument()
    expect(within(region).getByText(first.usage)).toBeInTheDocument()
  })

  it('shows skeletons while building', () => {
    render(<ColoursSection colours={null} />)
    expect(screen.getByRole('region', { name: 'Colours' })).toHaveAttribute('aria-busy', 'true')
  })

  it('shows the first colours and "Show all" for more than the limit', async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: COLOUR_LIMIT + 2 }, (_, i) => ({
      token: `c${i}`,
      hex: '#123456',
      label: `Colour ${i}`,
      usage: 'something'
    }))
    render(<ColoursSection colours={many} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(COLOUR_LIMIT)
    await user.click(screen.getByRole('button', { name: 'Show all' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(COLOUR_LIMIT + 2)
  })

  it('tolerates repeated tokens (two colours with the same role)', () => {
    const twin = { token: 'other', hex: '#111111', label: 'Other', usage: 'also used' }
    render(<ColoursSection colours={[twin, { ...twin, hex: '#222222' }]} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
