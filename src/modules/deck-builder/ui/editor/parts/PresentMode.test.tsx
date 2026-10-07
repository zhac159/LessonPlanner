import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixtureDeck, fixtureStyle } from '@shared/deck/testing'
import { IDLE_MS, PresentMode } from './PresentMode'

const slides = fixtureDeck().slides

const show = (startIndex = 0) => {
  const onExit = vi.fn()
  render(
    <PresentMode
      slides={slides}
      styleProfile={fixtureStyle()}
      startIndex={startIndex}
      onExit={onExit}
    />
  )
  return { onExit, user: userEvent.setup() }
}
const counter = () => screen.getByText(/ \/ 3$/).textContent

afterEach(() => vi.useRealTimers())

describe('PresentMode', () => {
  it('is a modal dialog with the slide and a counter', () => {
    show()
    expect(screen.getByRole('dialog', { name: 'Slide show' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Slide 1')).toBeInTheDocument()
    expect(counter()).toBe('1 / 3')
  })

  it('starts on the slide it is given', () => {
    show(2)
    expect(counter()).toBe('3 / 3')
  })

  it('never shows the editor’s extras: no fit badges, no regions, no notes', () => {
    show()
    expect(
      document.querySelector('.present')?.querySelector('[data-fit-badge], .fit-badge')
    ).toBeNull()
    expect(screen.queryByLabelText('Sticky note')).not.toBeInTheDocument()
  })

  it.each([
    ['ArrowRight', '2 / 3'],
    [' ', '2 / 3'],
    ['PageDown', '2 / 3'],
    ['n', '2 / 3']
  ])('%j goes to the next slide', (key, expected) => {
    show()
    fireEvent.keyDown(window, { key })
    expect(counter()).toBe(expected)
  })

  it('goes back with the left arrow and stops at the first slide', () => {
    show(1)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(counter()).toBe('1 / 3')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(counter()).toBe('1 / 3')
  })

  it('Home and End jump to the ends', () => {
    show(1)
    fireEvent.keyDown(window, { key: 'End' })
    expect(counter()).toBe('3 / 3')
    fireEvent.keyDown(window, { key: 'Home' })
    expect(counter()).toBe('1 / 3')
  })

  it('shows the end screen after the last slide; Esc and a click leave', async () => {
    const { onExit, user } = show(2)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('End of slide show. Click or press Esc to exit.')).toBeInTheDocument()
    await user.click(screen.getByRole('dialog'))
    expect(onExit).toHaveBeenCalledWith(2)
  })

  it('Esc exits and says which slide she was on', () => {
    const { onExit } = show(1)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledWith(2)
  })

  it('a click on the slide advances', async () => {
    const { user } = show()
    await user.click(screen.getByRole('dialog'))
    expect(counter()).toBe('2 / 3')
  })

  it('digits then Enter jump to a slide, with the typed number on screen', () => {
    show()
    fireEvent.keyDown(window, { key: '3' })
    expect(screen.getByRole('status')).toHaveTextContent('3')
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(counter()).toBe('3 / 3')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('B blacks out and W whites out the screen, and the key toggles back', () => {
    show()
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(window, { key: 'b' })
    expect(dialog).toHaveAttribute('data-screen', 'black')
    expect(screen.queryByLabelText('Slide 1')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'b' })
    expect(dialog).toHaveAttribute('data-screen', 'slide')
    fireEvent.keyDown(window, { key: 'w' })
    expect(dialog).toHaveAttribute('data-screen', 'white')
  })

  it('has real buttons in its bar: previous, next, exit', async () => {
    const { onExit, user } = show()
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next slide' }))
    expect(counter()).toBe('2 / 3')
    await user.click(screen.getByRole('button', { name: 'Previous slide' }))
    expect(counter()).toBe('1 / 3')
    await user.click(screen.getByRole('button', { name: 'Exit slide show' }))
    expect(onExit).toHaveBeenCalledWith(0)
  })

  it('lets keys with Ctrl or Alt pass', () => {
    show()
    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true })
    expect(counter()).toBe('1 / 3')
  })

  it('hides the control bar after 2 s without the mouse, and wakes it on movement', () => {
    vi.useFakeTimers()
    show()
    const dialog = screen.getByRole('dialog')
    expect(dialog).not.toHaveAttribute('data-idle')
    act(() => {
      vi.advanceTimersByTime(IDLE_MS + 10)
    })
    expect(dialog).toHaveAttribute('data-idle')
    fireEvent.mouseMove(dialog)
    expect(dialog).not.toHaveAttribute('data-idle')
  })
})
