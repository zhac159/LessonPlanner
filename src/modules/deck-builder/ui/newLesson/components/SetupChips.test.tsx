import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { initialSetup } from '../setup'
import { SetupChips } from './SetupChips'

function setup(patch = {}) {
  const onChange = vi.fn()
  render(<SetupChips setup={{ ...initialSetup().values, ...patch }} onChange={onChange} />)
  return { onChange, user: userEvent.setup() }
}

describe('SetupChips', () => {
  it('is a labelled group of four chips', () => {
    setup({ yearGroup: 'Year 8' })
    const group = screen.getByRole('group', { name: 'Lesson set-up' })
    expect(group.querySelectorAll('button')).toHaveLength(4)
    expect(screen.getByRole('button', { name: /^Year group: Year 8/ })).toBeInTheDocument()
  })

  it('offers Year 7 to 13 and Form time', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /^Year group/ }))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Year 7',
      'Year 8',
      'Year 9',
      'Year 10',
      'Year 11',
      'Year 12',
      'Year 13',
      'Form time'
    ])
  })

  it('reports each choice with its chip', async () => {
    const { user, onChange } = setup()
    await user.click(screen.getByRole('button', { name: /^Lesson length/ }))
    await user.click(screen.getByRole('option', { name: '45 min' }))
    expect(onChange).toHaveBeenLastCalledWith('length', 45)
    await user.click(screen.getByRole('button', { name: /^Ability/ }))
    await user.click(screen.getByRole('option', { name: 'Lower ability' }))
    expect(onChange).toHaveBeenLastCalledWith('ability', 'Lower ability')
    await user.click(screen.getByRole('button', { name: /^Number of slides/ }))
    await user.click(screen.getByRole('option', { name: 'About 15 slides' }))
    expect(onChange).toHaveBeenLastCalledWith('slides', 15)
  })

  it('keeps a length read from her text in the menu even when it is not a standard one', async () => {
    const { user } = setup({ durationMin: 55 })
    expect(screen.getByRole('button', { name: /^Lesson length: 55 min/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Lesson length/ }))
    expect(screen.getByRole('option', { name: '55 min' })).toBeInTheDocument()
  })

  it('works from the keyboard', async () => {
    const { user, onChange } = setup()
    screen.getByRole('button', { name: /^Ability/ }).focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('ability', expect.stringMatching(/ability$/))
  })
})
