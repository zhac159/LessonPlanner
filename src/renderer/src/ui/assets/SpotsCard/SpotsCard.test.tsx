import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SpotsCard } from './SpotsCard'

describe('SpotsCard', () => {
  it('says how many spots are left and offers "Fill the first one"', async () => {
    const onFillFirst = vi.fn()
    render(<SpotsCard count={3} onFillFirst={onFillFirst} />)
    expect(screen.getByText('3 picture spots to fill')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fill the first one' }))
    expect(onFillFirst).toHaveBeenCalledTimes(1)
  })

  it('uses the singular for one spot', () => {
    render(<SpotsCard count={1} onFillFirst={() => {}} />)
    expect(screen.getByText('1 picture spot to fill')).toBeInTheDocument()
  })

  it('turns mint and drops the button when every spot is filled', () => {
    render(<SpotsCard count={0} onFillFirst={() => {}} />)
    expect(screen.getByText('All picture spots are filled.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('region', { name: 'Picture spots' })).toHaveAttribute(
      'data-state',
      'done'
    )
  })

  it('announces the count politely as it changes', () => {
    render(<SpotsCard count={2} onFillFirst={() => {}} />)
    expect(screen.getByText('2 picture spots to fill')).toHaveAttribute('aria-live', 'polite')
  })
})
