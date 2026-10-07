import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FontSample, type FontSampleProps } from './FontSample'

const base: FontSampleProps = {
  family: 'Lexend',
  weight: 700,
  use: 'title',
  sizeRangePt: [40, 44],
  available: true,
  fallbackStack: "'Lexend', 'Segoe UI', sans-serif"
}

describe('FontSample', () => {
  it('names the family and weight and describes its use and size', () => {
    render(<FontSample {...base} />)
    expect(screen.getByText('Lexend Bold')).toBeInTheDocument()
    expect(screen.getByText('Titles · 40–44 pt')).toBeInTheDocument()
  })

  it('draws "Aa" in the real family, weight and the profile text colour', () => {
    render(<FontSample {...base} textColour="#12263A" />)
    const tile = screen.getByText('Aa')
    expect(tile).toHaveStyle({ fontWeight: '700', color: '#12263A' })
    expect(tile.style.fontFamily).toContain('Lexend')
    expect(tile).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows no fallback note for an installed font', () => {
    render(<FontSample {...base} />)
    expect(screen.queryByText(/Not installed/)).toBeNull()
  })

  it('says which font stands in when the font is not installed', () => {
    render(<FontSample {...base} available={false} />)
    expect(screen.getByText('Not installed — shown in Segoe UI')).toBeInTheDocument()
  })

  it('copes with a missing size range and a regular body weight', () => {
    render(<FontSample {...base} use="body" weight={400} sizeRangePt={null} />)
    expect(screen.getByText('Lexend Regular')).toBeInTheDocument()
    expect(screen.getByText('Body text')).toBeInTheDocument()
  })
})
