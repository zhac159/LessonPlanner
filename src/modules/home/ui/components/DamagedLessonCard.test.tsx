import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { lesson } from '../fixtures'
import { DamagedLessonCard } from './DamagedLessonCard'

describe('DamagedLessonCard', () => {
  it('says the file cannot be read and keeps the title as the card name', () => {
    render(
      <DamagedLessonCard
        lesson={lesson({ title: 'Photosynthesis', damaged: true })}
        onRetry={() => {}}
        onDelete={() => {}}
      />
    )
    const card = screen.getByRole('article', { name: 'Photosynthesis' })
    expect(card).toHaveAccessibleDescription('I couldn’t read this lesson’s file.')
  })

  it('falls back to "Untitled lesson" when the title is lost', () => {
    render(
      <DamagedLessonCard
        lesson={lesson({ title: '', damaged: true })}
        onRetry={() => {}}
        onDelete={() => {}}
      />
    )
    expect(screen.getByRole('heading', { name: 'Untitled lesson' })).toBeInTheDocument()
  })

  it('offers Try again and Delete…', async () => {
    const onRetry = vi.fn()
    const onDelete = vi.fn()
    render(
      <DamagedLessonCard lesson={lesson({ damaged: true })} onRetry={onRetry} onDelete={onDelete} />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete…' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
