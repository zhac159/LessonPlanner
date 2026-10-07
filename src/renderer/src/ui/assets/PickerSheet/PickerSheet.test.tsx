import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PickerSheet, type PickerTab } from './PickerSheet'

function Demo({ onBack, onSkip }: { onBack?: () => void; onSkip?: () => void }) {
  const [tab, setTab] = useState<PickerTab>('assets')
  return (
    <PickerSheet
      title="Fill this picture spot"
      subtitle="“A leaf in sunlight, close up” · slide 3 · 1 of 3"
      tab={tab}
      onTabChange={setTab}
      onBack={onBack}
      footer={<button onClick={onSkip}>Skip</button>}
    >
      <p>{`Content of ${tab}`}</p>
    </PickerSheet>
  )
}

describe('PickerSheet', () => {
  it('shows the header copy, the three tabs and the footer', () => {
    render(<Demo />)
    expect(screen.getByRole('dialog', { name: 'Fill this picture spot' })).toBeInTheDocument()
    expect(
      screen.getByText('“A leaf in sunlight, close up” · slide 3 · 1 of 3')
    ).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Your assets',
      'Find online',
      'Make one'
    ])
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()
  })

  it('shows the content of the chosen tab in a tabpanel labelled by that tab', async () => {
    render(<Demo />)
    expect(screen.getByRole('tabpanel', { name: 'Your assets' })).toHaveTextContent(
      'Content of assets'
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Find online' }))
    expect(screen.getByRole('tabpanel', { name: 'Find online' })).toHaveTextContent(
      'Content of online'
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Make one' }))
    expect(screen.getByRole('tabpanel', { name: 'Make one' })).toHaveTextContent('Content of make')
  })

  it('passes back and footer actions through', async () => {
    const onBack = vi.fn()
    const onSkip = vi.fn()
    render(<Demo onBack={onBack} onSkip={onSkip} />)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('can offer fewer tabs', () => {
    render(
      <PickerSheet
        title="T"
        tab="assets"
        onTabChange={() => {}}
        tabs={[{ id: 'assets', label: 'Your assets' }]}
      >
        x
      </PickerSheet>
    )
    expect(screen.getAllByRole('tab')).toHaveLength(1)
  })
})
