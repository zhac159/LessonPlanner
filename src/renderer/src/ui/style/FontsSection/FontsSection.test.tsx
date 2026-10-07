import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { sampleData } from '../galleryData'
import { FontsSection } from './FontsSection'

const fonts = sampleData.fonts ?? []

describe('FontsSection', () => {
  it('shows a sample per learned font', () => {
    render(<FontsSection fonts={fonts} />)
    expect(screen.getByRole('region', { name: 'Fonts' })).toBeInTheDocument()
    expect(screen.getByText('Lexend Bold')).toBeInTheDocument()
    expect(screen.getByText('Titles · 40–44 pt')).toBeInTheDocument()
    expect(screen.getByText('Lexend Regular')).toBeInTheDocument()
    expect(screen.getByText('Body text · 20–24 pt')).toBeInTheDocument()
  })

  it('passes the text colour to every "Aa" tile', () => {
    render(<FontsSection fonts={fonts} textColour="#12263A" />)
    for (const tile of screen.getAllByText('Aa')) expect(tile).toHaveStyle({ color: '#12263A' })
  })

  it('notes a font that is not installed', () => {
    render(<FontsSection fonts={fonts.map((font) => ({ ...font, available: false }))} />)
    expect(screen.getAllByText(/Not installed — shown in/)).toHaveLength(fonts.length)
  })

  it('copes with several fonts sharing a role', () => {
    render(<FontsSection fonts={[fonts[0], { ...fonts[0], family: 'Caveat' }]} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('shows skeletons while building', () => {
    render(<FontsSection fonts={null} />)
    expect(screen.getByRole('region', { name: 'Fonts' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Aa')).toBeNull()
  })
})
