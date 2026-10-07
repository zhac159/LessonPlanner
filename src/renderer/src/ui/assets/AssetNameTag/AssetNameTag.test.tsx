import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AssetNameTag } from './AssetNameTag'

describe('AssetNameTag', () => {
  it('shows the name', () => {
    render(<AssetNameTag>school_logo</AssetNameTag>)
    expect(screen.getByText('school_logo')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows a preview note and can announce it', () => {
    render(<AssetNameTag live>leaf_cross_section · fitted to region 1</AssetNameTag>)
    expect(screen.getByRole('status')).toHaveTextContent('leaf_cross_section · fitted to region 1')
  })
})
