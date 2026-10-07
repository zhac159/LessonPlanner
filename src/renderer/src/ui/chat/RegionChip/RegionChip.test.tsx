import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RegionChip } from './RegionChip'

describe('RegionChip', () => {
  it('shows the number and "Slide 3 · circled"', () => {
    render(<RegionChip n={1} slideNumber={3} onClick={() => {}} />)
    expect(screen.getByText('Slide 3 · circled')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('names the button after the region, slide and what is under it', () => {
    render(<RegionChip n={1} slideNumber={3} description="photo of a leaf" onClick={() => {}} />)
    expect(
      screen.getByRole('button', { name: 'Region 1 on slide 3: photo of a leaf' })
    ).toBeInTheDocument()
  })

  it('jumps to the slide on click and with the keyboard', async () => {
    const onClick = vi.fn()
    render(<RegionChip n={2} slideNumber={4} onClick={onClick} />)
    const chip = screen.getByRole('button', { name: 'Region 2 on slide 4' })
    await userEvent.click(chip)
    chip.focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('is plain text without a click handler', () => {
    render(<RegionChip n={1} slideNumber={3} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Slide 3 · circled')).toBeInTheDocument()
  })

  it('adds a named remove button when staged', async () => {
    const onRemove = vi.fn()
    render(<RegionChip n={1} slideNumber={3} onClick={() => {}} onRemove={onRemove} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove region 1' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('treats a drawing as a chip without a disc and says "Remove drawing"', () => {
    render(<RegionChip slideNumber={2} caption="marked up" onRemove={() => {}} />)
    expect(screen.getByText('Slide 2 · marked up')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove drawing' })).toBeInTheDocument()
  })

  it('lets the remove label be overridden', () => {
    render(<RegionChip n={1} slideNumber={3} onRemove={() => {}} removeLabel="Drop it" />)
    expect(screen.getByRole('button', { name: 'Drop it' })).toBeInTheDocument()
  })

  it('reports hover and focus so the region can be highlighted', async () => {
    const onHighlight = vi.fn()
    render(<RegionChip n={1} slideNumber={3} onClick={() => {}} onHighlight={onHighlight} />)
    const chip = screen.getByRole('button')
    await userEvent.hover(chip)
    expect(onHighlight).toHaveBeenLastCalledWith(true)
    await userEvent.unhover(chip)
    expect(onHighlight).toHaveBeenLastCalledWith(false)
    await userEvent.tab()
    expect(onHighlight).toHaveBeenLastCalledWith(true)
    await userEvent.tab()
    expect(onHighlight).toHaveBeenLastCalledWith(false)
  })

  it('when its slide was deleted reads "Slide 3 · removed" and cannot be clicked', () => {
    const onClick = vi.fn()
    const { container } = render(<RegionChip n={1} slideNumber={3} removed onClick={onClick} />)
    expect(screen.getByText('Slide 3 · removed')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.firstElementChild).toHaveAttribute('data-removed', 'true')
  })
})
