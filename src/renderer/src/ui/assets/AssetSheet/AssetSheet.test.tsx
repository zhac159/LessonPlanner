import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssetSheet } from './AssetSheet'

describe('AssetSheet (band)', () => {
  it('is a non-modal dialog named after its title, with subtitle, badge, body and footer', () => {
    render(
      <AssetSheet
        title="Add to region 1"
        subtitle="Pick an asset. I'll scale it to fit your circle."
        badge="1"
        footer={<button>Place it</button>}
      >
        <p>Body</p>
      </AssetSheet>
    )
    const dialog = screen.getByRole('dialog', { name: 'Add to region 1' })
    expect(dialog).toHaveAttribute('aria-modal', 'false')
    expect(screen.getByRole('heading', { name: 'Add to region 1' })).toBeInTheDocument()
    expect(screen.getByText("Pick an asset. I'll scale it to fit your circle.")).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Place it' })).toBeInTheDocument()
  })

  it('has a back button only when asked for', async () => {
    const onBack = vi.fn()
    const { rerender } = render(<AssetSheet title="Fill this picture spot">x</AssetSheet>)
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    rerender(
      <AssetSheet title="Fill this picture spot" onBack={onBack}>
        x
      </AssetSheet>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('can name its dialog differently from the title', () => {
    render(
      <AssetSheet title="Fill this picture spot" label="Picture spot 1 of 3">
        x
      </AssetSheet>
    )
    expect(screen.getByRole('dialog', { name: 'Picture spot 1 of 3' })).toBeInTheDocument()
  })

  it('Esc and Ctrl+Enter call their handlers from inside the sheet', async () => {
    const onEscape = vi.fn()
    const onSubmitShortcut = vi.fn()
    render(
      <AssetSheet title="T" onEscape={onEscape} onSubmitShortcut={onSubmitShortcut}>
        <input aria-label="Search" />
      </AssetSheet>
    )
    await userEvent.click(screen.getByLabelText('Search'))
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(onSubmitShortcut).toHaveBeenCalledTimes(1)
  })

  it('a plain Enter does nothing', async () => {
    const onSubmitShortcut = vi.fn()
    render(
      <AssetSheet title="T" onSubmitShortcut={onSubmitShortcut}>
        <input aria-label="Search" />
      </AssetSheet>
    )
    await userEvent.click(screen.getByLabelText('Search'))
    await userEvent.keyboard('{Enter}')
    expect(onSubmitShortcut).not.toHaveBeenCalled()
  })
})

describe('AssetSheet (card)', () => {
  it('has back and close buttons and no coloured band', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <AssetSheet title="Add an asset" variant="card" onBack={() => {}} onClose={onClose}>
        x
      </AssetSheet>
    )
    expect(container.querySelector('.ui-band')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Add an asset' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })
})
