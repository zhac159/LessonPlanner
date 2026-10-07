import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('shows the upper-cased initial and names itself after the person', () => {
    render(<Avatar name="alice" />)
    expect(screen.getByRole('img', { name: 'alice' })).toHaveTextContent('A')
  })

  it('falls back to a question mark for an empty name', () => {
    render(<Avatar name="  " />)
    expect(screen.getByRole('img')).toHaveTextContent('?')
  })

  it('applies the requested size', () => {
    render(<Avatar name="Bo" size={44} />)
    expect(screen.getByRole('img')).toHaveStyle({ width: '44px', height: '44px' })
  })
})
