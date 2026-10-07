import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssetChip } from './AssetChip'

describe('AssetChip', () => {
  it('shows the picture and the chat name in an inline chip', () => {
    const { container } = render(
      <AssetChip name="school_logo" thumbSrc="data:image/png;base64,AA" variant="inline" />
    )
    expect(screen.getByText('school_logo')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
    expect(container.firstElementChild).toHaveAttribute('data-variant', 'inline')
  })

  it('shows a popover with the title and kind on hover and hides it again', async () => {
    render(<AssetChip name="school_logo" title="School logo" kind="logo" />)
    expect(screen.queryByRole('tooltip')).toBeNull()
    await userEvent.hover(screen.getByText('school_logo'))
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('School logo')
    expect(tip).toHaveTextContent('Logo')
    await userEvent.unhover(screen.getByText('school_logo'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows the popover on keyboard focus, points the chip at it and closes it with Escape', async () => {
    render(<AssetChip name="owl_mascot" title="Owl mascot" kind="character" />)
    await userEvent.tab()
    const tip = screen.getByRole('tooltip')
    expect(screen.getByRole('group', { name: 'owl_mascot' })).toHaveAttribute(
      'aria-describedby',
      tip.id
    )
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('falls back to the name when there is no title', async () => {
    render(<AssetChip name="leaf_icon" />)
    await userEvent.hover(screen.getByText('leaf_icon'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('leaf_icon')
  })

  it('composer variant has a named remove button and Backspace removes too', async () => {
    const onRemove = vi.fn()
    render(<AssetChip name="owl_mascot" variant="composer" onRemove={onRemove} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove owl_mascot' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
    screen.getByRole('group', { name: 'owl_mascot' }).focus()
    await userEvent.keyboard('{Backspace}')
    expect(onRemove).toHaveBeenCalledTimes(2)
  })

  it('inline variant has no remove button', () => {
    render(<AssetChip name="owl_mascot" onRemove={() => {}} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('removed variant is greyed, says "removed" and shows no popover', async () => {
    const { container } = render(<AssetChip name="old_logo" variant="removed" kind="logo" />)
    expect(screen.getByText('removed')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('data-variant', 'removed')
    await userEvent.hover(screen.getByText('old_logo'))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
