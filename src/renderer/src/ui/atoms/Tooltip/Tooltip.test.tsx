import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Tooltip, TOOLTIP_DELAY_MS } from './Tooltip'

describe('Tooltip', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('appears after the hover delay and links itself to the control', () => {
    render(
      <Tooltip label="Home" placement="right">
        <button type="button">h</button>
      </Tooltip>
    )
    const button = screen.getByRole('button')
    fireEvent.mouseEnter(button.parentElement!)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_DELAY_MS)
    })
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('Home')
    expect(tip).toHaveAttribute('data-placement', 'right')
    expect(button).toHaveAttribute('aria-describedby', tip.id)
  })

  it('does not appear if the pointer leaves before the delay', () => {
    render(
      <Tooltip label="Home">
        <button type="button">h</button>
      </Tooltip>
    )
    const host = screen.getByRole('button').parentElement!
    fireEvent.mouseEnter(host)
    fireEvent.mouseLeave(host)
    act(() => {
      vi.advanceTimersByTime(TOOLTIP_DELAY_MS * 2)
    })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows immediately on keyboard focus, hides on blur and on Escape', () => {
    render(
      <Tooltip label="Plus">
        <button type="button">+</button>
      </Tooltip>
    )
    const button = screen.getByRole('button')
    fireEvent.focus(button)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    fireEvent.focus(button)
    fireEvent.blur(button)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(button).not.toHaveAttribute('aria-describedby')
  })
})
