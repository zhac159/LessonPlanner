import { render } from '@testing-library/react'
import { Monitor } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { IconTile } from './IconTile'

describe('IconTile', () => {
  it('is decorative and exposes size and tone', () => {
    const { container } = render(
      <IconTile size={76} tone="yellow">
        <Monitor />
      </IconTile>
    )
    const tile = container.firstElementChild as HTMLElement
    expect(tile).toHaveAttribute('aria-hidden', 'true')
    expect(tile).toHaveAttribute('data-size', '76')
    expect(tile).toHaveAttribute('data-tone', 'yellow')
    expect(tile.querySelector('svg')).toBeInTheDocument()
  })

  it('defaults to a white 52px tile', () => {
    const { container } = render(<IconTile>x</IconTile>)
    const tile = container.firstElementChild as HTMLElement
    expect(tile).toHaveAttribute('data-size', '52')
    expect(tile).toHaveAttribute('data-tone', 'white')
  })
})
