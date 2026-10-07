import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { sampleData } from '../galleryData'
import { VOICE_LIMIT, VoiceSection } from './VoiceSection'

const rules = sampleData.voiceRules ?? []

describe('VoiceSection', () => {
  it('lists her writing rules under "How you write"', () => {
    render(<VoiceSection rules={rules} />)
    expect(screen.getByRole('region', { name: 'How you write' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(rules.length)
    expect(screen.getByText(rules[0])).toBeInTheDocument()
  })

  it('shows skeletons while building', () => {
    render(<VoiceSection rules={null} />)
    expect(screen.getByRole('region', { name: 'How you write' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
  })

  it('shows the first rules and expands with "Show all"', async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: VOICE_LIMIT + 1 }, (_, i) => `Rule ${i}`)
    render(<VoiceSection rules={many} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(VOICE_LIMIT)
    await user.click(screen.getByRole('button', { name: 'Show all' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(VOICE_LIMIT + 1)
  })
})
