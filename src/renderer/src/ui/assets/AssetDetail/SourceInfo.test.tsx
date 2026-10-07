import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LICENCES } from '@shared/assets/credits'
import { CreditLine, PROVIDER_LABELS, SourceLine } from './SourceInfo'

describe('SourceLine', () => {
  it('shows the source, the licence and a link to the source page', async () => {
    const onOpenSource = vi.fn()
    render(
      <SourceLine
        provider="wikimedia"
        licence={{ id: 'cc-by-sa', label: 'CC BY-SA 4.0' }}
        onOpenSource={onOpenSource}
      />
    )
    expect(screen.getByText('Wikimedia Commons')).toBeInTheDocument()
    expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open source page' }))
    expect(onOpenSource).toHaveBeenCalledTimes(1)
  })

  it('has no link without a handler and no source name without a provider', () => {
    render(<SourceLine provider={null} licence={LICENCES.generated} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Made for you')).toBeInTheDocument()
  })

  it('names every provider', () => {
    expect(Object.values(PROVIDER_LABELS)).toEqual([
      'Openverse',
      'Wikimedia Commons',
      'Pexels',
      'Unsplash'
    ])
  })

  it('shows an amber licence exactly, not as "Check licence"', () => {
    render(<SourceLine provider="openverse" licence={LICENCES['cc-by-nc']} />)
    expect(screen.getByText('CC BY-NC')).toBeInTheDocument()
  })
})

describe('CreditLine', () => {
  it('shows the credit text read-only and says it goes in the notes', () => {
    render(
      <CreditLine
        credit={{ text: '“Volcano” by Ann, CC BY-SA 4.0, via Wikimedia Commons', inNotes: true }}
      />
    )
    expect(screen.getByTestId('credit-text')).toHaveTextContent(
      '“Volcano” by Ann, CC BY-SA 4.0, via Wikimedia Commons'
    )
    expect(
      screen.getByText('Added to the speaker notes of slides that use it.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('does not mention notes when no credit goes there', () => {
    render(<CreditLine credit={{ text: 'Picture drawn by Claude.', inNotes: false }} />)
    expect(screen.queryByText(/speaker notes/)).toBeNull()
  })
})
