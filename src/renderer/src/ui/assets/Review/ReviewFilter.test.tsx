import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReviewFilter } from './ReviewFilter'

describe('ReviewFilter', () => {
  it('offers All, Keeping and Left out with the current one pressed', () => {
    render(<ReviewFilter value="keeping" onChange={() => {}} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'All',
      'Keeping',
      'Left out'
    ])
    expect(screen.getByRole('button', { name: 'Keeping' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports a new choice and ignores a click on the current one', async () => {
    const onChange = vi.fn()
    render(<ReviewFilter value="all" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Left out' }))
    expect(onChange).toHaveBeenCalledWith('left-out')
    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
