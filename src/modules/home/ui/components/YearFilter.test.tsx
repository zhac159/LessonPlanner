import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ALL_YEARS } from '../model/lessons'
import { YearFilter } from './YearFilter'

const YEARS = ['Year 7', 'Year 8', 'Form time']

describe('YearFilter', () => {
  it('is a named group with All and one chip per year group', () => {
    render(<YearFilter years={YEARS} value={ALL_YEARS} onChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'Filter by year group' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'All',
      'Year 7',
      'Year 8',
      'Form time'
    ])
  })

  it('presses only the selected chip', () => {
    render(<YearFilter years={YEARS} value="Year 8" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Year 8' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('selects a chip when it is pressed', async () => {
    const onChange = vi.fn()
    render(<YearFilter years={YEARS} value={ALL_YEARS} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Year 7' }))
    expect(onChange).toHaveBeenCalledWith('Year 7')
  })

  it('goes back to All when the pressed chip is pressed again', async () => {
    const onChange = vi.fn()
    render(<YearFilter years={YEARS} value="Year 7" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Year 7' }))
    expect(onChange).toHaveBeenCalledWith(ALL_YEARS)
  })

  it('keeps All selected when All is pressed again', async () => {
    const onChange = vi.fn()
    render(<YearFilter years={YEARS} value={ALL_YEARS} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onChange).toHaveBeenCalledWith(ALL_YEARS)
  })

  it('can be reached and used from the keyboard', async () => {
    const onChange = vi.fn()
    render(<YearFilter years={YEARS} value={ALL_YEARS} onChange={onChange} />)
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('Year 7')
  })
})
