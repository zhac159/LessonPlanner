import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { sampleData } from '../galleryData'
import { HABIT_LIMIT, HabitsSection } from './HabitsSection'

const habits = sampleData.habits ?? []

describe('HabitsSection', () => {
  it('lists the habits under "Layout habits"', () => {
    render(<HabitsSection habits={habits} />)
    expect(screen.getByRole('region', { name: 'Layout habits' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(habits.length)
    expect(screen.getByText(habits[0])).toBeInTheDocument()
  })

  it('shows skeletons while building', () => {
    render(<HabitsSection habits={null} />)
    expect(screen.getByRole('region', { name: 'Layout habits' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('says so when no habits were found', () => {
    render(<HabitsSection habits={[]} />)
    expect(screen.getByText('Nothing picked up yet.')).toBeInTheDocument()
  })

  it('shows the first habits and expands with "Show all"', async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: HABIT_LIMIT + 2 }, (_, i) => `Habit ${i}`)
    render(<HabitsSection habits={many} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(HABIT_LIMIT)
    await user.click(screen.getByRole('button', { name: 'Show all' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(HABIT_LIMIT + 2)
  })
})
