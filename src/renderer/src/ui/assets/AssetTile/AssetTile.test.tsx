import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssetTile } from './AssetTile'

describe('AssetTile', () => {
  it('is a button named by the full chat name with an empty-alt picture', () => {
    const { container } = render(
      <AssetTile name="plant_cell_diagram" thumbSrc="data:image/png;base64,AA" />
    )
    const tile = screen.getByRole('button', { name: 'plant_cell_diagram' })
    expect(tile).toHaveAttribute('title', 'plant_cell_diagram')
    expect(tile).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('calls onClick on click and with Enter and Space', async () => {
    const onClick = vi.fn()
    render(<AssetTile name="owl_mascot" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    screen.getByRole('button').focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('shows the selected ring and aria-pressed when selected', () => {
    render(<AssetTile name="owl_mascot" selected />)
    const tile = screen.getByRole('button')
    expect(tile).toHaveAttribute('aria-pressed', 'true')
    expect(tile).toHaveAttribute('data-selected', 'true')
  })

  it('shows a placeholder when the thumbnail is not ready', () => {
    const { container } = render(<AssetTile name="new_icon" thumbSrc={null} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[data-empty]')).not.toBeNull()
  })

  it('takes roving-grid props', () => {
    render(
      <AssetTile
        name="a_b"
        itemProps={{ 'data-grid-item': '', 'data-grid-key': 'k', tabIndex: -1, onFocus: () => {} }}
      />
    )
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1')
  })
})
