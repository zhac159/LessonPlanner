import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VersionPicker, type VersionView } from './VersionPicker'

const ready = (index: number): VersionView => ({
  index,
  state: 'ready',
  thumbSrc: 'data:image/png;base64,AA'
})
const FOUR = [ready(1), ready(2), ready(3), ready(4)]

describe('VersionPicker', () => {
  it('is a labelled radio group with one numbered radio per version', () => {
    render(<VersionPicker versions={FOUR} selected={3} onSelect={() => {}} />)
    const group = screen.getByRole('radiogroup', { name: 'Pick the one you like' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Version 1',
      'Version 2',
      'Version 3',
      'Version 4'
    ])
    expect(screen.getByRole('radio', { name: 'Version 3' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Version 1' })).not.toBeChecked()
  })

  it('announces which version is selected', () => {
    render(<VersionPicker versions={FOUR} selected={3} onSelect={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Version 3 selected')
  })

  it('selects on click', async () => {
    const onSelect = vi.fn()
    render(<VersionPicker versions={FOUR} selected={null} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Version 2' }))
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('has one tab stop (the chosen one, else the first) and arrows move the choice', async () => {
    const onSelect = vi.fn()
    render(<VersionPicker versions={FOUR} selected={null} onSelect={onSelect} />)
    expect(screen.getByRole('radio', { name: 'Version 1' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'Version 2' })).toHaveAttribute('tabindex', '-1')
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    expect(onSelect).toHaveBeenLastCalledWith(2)
    expect(screen.getByRole('radio', { name: 'Version 2' })).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(onSelect).toHaveBeenLastCalledWith(4)
  })

  it('waiting versions shimmer with the stage and cannot be picked', async () => {
    const onSelect = vi.fn()
    render(
      <VersionPicker
        versions={[ready(1), { index: 2, state: 'waiting' }]}
        selected={null}
        onSelect={onSelect}
        stageLabel="Looking at your pictures…"
      />
    )
    expect(screen.getByText('Looking at your pictures…')).toBeInTheDocument()
    const waiting = screen.getByRole('radio', { name: 'Version 2, still making' })
    expect(waiting).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(waiting)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('waiting says "Drawing…" by default', () => {
    render(
      <VersionPicker
        versions={[{ index: 1, state: 'waiting' }]}
        selected={null}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('Drawing…')).toBeInTheDocument()
  })

  it("a failed version says 'Didn't work' and offers 'Try this one again'", async () => {
    const onRetryVersion = vi.fn()
    const onSelect = vi.fn()
    render(
      <VersionPicker
        versions={[ready(1), { index: 2, state: 'failed' }]}
        selected={1}
        onSelect={onSelect}
        onRetryVersion={onRetryVersion}
      />
    )
    expect(screen.getByText("Didn't work")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: "Version 2, didn't work" }))
    expect(onSelect).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /Try this one again/ }))
    expect(onRetryVersion).toHaveBeenCalledWith(2)
  })

  it('arrows skip versions that are not ready', async () => {
    const onSelect = vi.fn()
    render(
      <VersionPicker
        versions={[ready(1), { index: 2, state: 'waiting' }, ready(3)]}
        selected={1}
        onSelect={onSelect}
      />
    )
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    expect(onSelect).toHaveBeenLastCalledWith(3)
  })

  it('draws ready pictures with empty alt text', () => {
    const { container } = render(
      <VersionPicker versions={[ready(1)]} selected={1} onSelect={() => {}} />
    )
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })
})
